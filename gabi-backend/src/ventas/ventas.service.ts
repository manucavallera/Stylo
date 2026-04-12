import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVentaDto } from './dto/create-venta.dto';

@Injectable()
export class VentasService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Registrar venta (POS local u online) ─────────────────────
    async create(dto: CreateVentaDto) {
        // Verificar prenda
        const prenda = await this.prisma.prenda.findUnique({
            where: { id: dto.prendaId },
        });
        if (!prenda) throw new NotFoundException('Prenda no encontrada');
        if (prenda.estado === 'VENDIDO') {
            throw new BadRequestException('Esta prenda ya fue vendida');
        }
        if (prenda.estado === 'RETIRADO') {
            throw new BadRequestException('No se puede vender una prenda retirada');
        }

        // Transacción: crear venta + actualizar estado prenda + actualizar caja
        const venta = await this.prisma.$transaction(async (tx) => {
            // Guardar el costo histórico para analytics futuros
            const venta = await tx.venta.create({
                data: {
                    prendaId: dto.prendaId,
                    reservaId: dto.reservaId,
                    clienteId: dto.clienteId,
                    cajaId: dto.cajaId,
                    precioFinal: dto.precioFinal,
                    costoHistoricoArs: prenda.costoUnitario, // congelado al momento de venta
                    metodoPago: dto.metodoPago,
                    canalVenta: dto.canalVenta,
                },
                include: {
                    prenda: { include: { categoria: true, talle: true } },
                    cliente: true,
                    reserva: true,
                },
            });

            // Prenda pasa a VENDIDO
            await tx.prenda.update({
                where: { id: dto.prendaId },
                data: { estado: 'VENDIDO' },
            });

            // Si hay caja abierta y es EFECTIVO, sumar al monto esperado físico
            if (dto.cajaId && dto.metodoPago === 'EFECTIVO') {
                await tx.cajaDiaria.update({
                    where: { id: dto.cajaId },
                    data: { montoEsperado: { increment: dto.precioFinal } },
                });
            }

            // Si venía de reserva, marcarla como confirmada
            if (dto.reservaId) {
                await tx.reserva.update({
                    where: { id: dto.reservaId },
                    data: { estado: 'CONFIRMADA' },
                });
            }

            return venta;
        });

        // ── Notificar al grupo de WA (fire-and-forget) ───────────
        this.notificarVentaAlGrupo(venta).catch(() => { });

        return venta;
    }

    private async notificarVentaAlGrupo(venta: any) {
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE;
        if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) return;

        const grupos = await this.prisma.grupoWhatsapp.findMany({ where: { activo: true } });
        if (grupos.length === 0) return;

        const categoria = venta.prenda?.categoria?.nombre ?? 'Prenda';
        const talle = venta.prenda?.talle?.nombre;
        const precio = Number(venta.precioFinal).toLocaleString('es-AR');
        const desc = talle ? `${categoria} — Talle ${talle}` : categoria;
        const mensaje = `🔴 *VENDIDO*\n👗 ${desc}\n💰 $${precio}`;

        // Buscar foto de la prenda
        const prenda = await this.prisma.prenda.findUnique({
            where: { id: venta.prendaId },
            include: { fotos: { take: 1, orderBy: { orden: 'asc' } } },
        });
        const fotoUrl = prenda?.fotos?.[0]?.url;

        if (fotoUrl) {
            // Intentar convertir a base64 (más confiable que URL pública)
            let mediaBase64: string | null = null;
            try {
                const imgRes = await fetch(fotoUrl);
                if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer();
                    mediaBase64 = Buffer.from(buffer).toString('base64');
                }
            } catch { /* fallback a URL si falla */ }

            await Promise.allSettled(
                grupos.map((grupo) =>
                    fetch(`${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                        body: JSON.stringify({
                            number: grupo.groupId,
                            mediatype: 'image',
                            mimetype: 'image/jpeg',
                            media: mediaBase64 ?? fotoUrl,
                            caption: mensaje,
                            fileName: 'prenda.jpg',
                        }),
                    }),
                ),
            );
        } else {
            // Sin foto, mandar solo texto
            await Promise.allSettled(
                grupos.map((grupo) =>
                    fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                        body: JSON.stringify({ number: grupo.groupId, text: mensaje }),
                    }),
                ),
            );
        }
    }

    // ── Listado de ventas del día ────────────────────────────────
    findHoy() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        return this.prisma.venta.findMany({
            where: { fechaVenta: { gte: hoy, lt: manana } },
            include: {
                prenda: { include: { categoria: true, talle: true } },
                cliente: true,
            },
            orderBy: { fechaVenta: 'desc' },
        });
    }

    // ── Resumen de ventas del día ────────────────────────────────
    async resumenHoy() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const [totales, porMetodo] = await Promise.all([
            this.prisma.venta.aggregate({
                where: { fechaVenta: { gte: hoy, lt: manana } },
                _sum: { precioFinal: true, costoHistoricoArs: true },
                _count: true,
            }),
            this.prisma.venta.groupBy({
                by: ['metodoPago'],
                where: { fechaVenta: { gte: hoy, lt: manana } },
                _sum: { precioFinal: true },
                _count: true,
            }),
        ]);

        const totalVendido = Number(totales._sum.precioFinal ?? 0);
        const totalCosto = Number(totales._sum.costoHistoricoArs ?? 0);

        return {
            cantidadVentas: totales._count,
            totalVendido,
            totalCosto,
            gananciaEstimada: totalVendido - totalCosto,
            porMetodoPago: porMetodo,
        };
    }

    // ── Resumen diario para el bot de WA (n8n lo llama a las 21hs) ──
    async resumenDiario() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const [ventas, reservasActivas, prendasSinFoto] = await Promise.all([
            this.prisma.venta.findMany({
                where: { fechaVenta: { gte: hoy, lt: manana } },
                select: { precioFinal: true, metodoPago: true },
            }),
            this.prisma.reserva.count({ where: { estado: 'ACTIVA' } }),
            this.prisma.prenda.count({
                where: { estado: 'DISPONIBLE', fotos: { none: {} } },
            }),
        ]);

        const totalVendido = ventas.reduce((sum, v) => sum + Number(v.precioFinal), 0);
        const porMetodo = ventas.reduce((acc: Record<string, number>, v) => {
            acc[v.metodoPago] = (acc[v.metodoPago] || 0) + Number(v.precioFinal);
            return acc;
        }, {});

        return {
            fecha: hoy.toLocaleDateString('es-AR'),
            cantidadVentas: ventas.length,
            totalVendido,
            porMetodo,
            reservasActivas,
            prendasSinFoto,
        };
    }

    findOne(id: string) {
        return this.prisma.venta.findUnique({
            where: { id },
            include: { prenda: true, cliente: true, comprobante: true },
        });
    }

    // ── Balance KPIs (rápido, sin detalle de ventas) ────────────
    async balance(desde: string, hasta: string) {
        const fechaDesde = new Date(desde);
        fechaDesde.setHours(0, 0, 0, 0);
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        const where = { fechaVenta: { gte: fechaDesde, lte: fechaHasta } };

        const [totales, porMetodo, porCategoria, gastos] = await Promise.all([
            this.prisma.venta.aggregate({
                where,
                _sum: { precioFinal: true },
                _count: true,
            }),
            this.prisma.venta.groupBy({
                by: ['metodoPago'],
                where,
                _sum: { precioFinal: true },
                _count: true,
            }),
            // Breakdown por categoría via prendas
            this.prisma.venta.findMany({
                where,
                select: {
                    precioFinal: true,
                    prenda: { select: { categoria: { select: { nombre: true } } } },
                },
            }),
            // Gastos y retiros de cajas en el período
            this.prisma.gastoCaja.findMany({
                where: { caja: { fecha: { gte: fechaDesde, lte: fechaHasta } } },
                select: { monto: true, tipo: true, concepto: true },
            }),
        ]);

        const totalVendido = Number(totales._sum.precioFinal ?? 0);

        // Agrupar por categoría manualmente
        const catMap = new Map<string, { total: number; cantidad: number }>();
        for (const v of porCategoria) {
            const cat = v.prenda?.categoria?.nombre ?? 'Sin categoría';
            const entry = catMap.get(cat) ?? { total: 0, cantidad: 0 };
            entry.total += Number(v.precioFinal);
            entry.cantidad += 1;
            catMap.set(cat, entry);
        }
        const porCategoriaSorted = Array.from(catMap.entries())
            .map(([nombre, data]) => ({ nombre, ...data }))
            .sort((a, b) => b.total - a.total);

        const totalGastos = gastos.filter(g => g.tipo === 'GASTO').reduce((s, g) => s + Number(g.monto), 0);
        const totalRetiros = gastos.filter(g => g.tipo === 'RETIRO').reduce((s, g) => s + Number(g.monto), 0);

        return {
            desde: fechaDesde.toISOString(),
            hasta: fechaHasta.toISOString(),
            cantidadVentas: totales._count,
            totalVendido,
            porMetodoPago: porMetodo,
            porCategoria: porCategoriaSorted,
            totalGastos,
            totalRetiros,
        };
    }

    // ── Detalle de ventas del período (paginado) ─────────────────
    async balanceDetalle(desde: string, hasta: string, skip = 0, take = 50) {
        const fechaDesde = new Date(desde);
        fechaDesde.setHours(0, 0, 0, 0);
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        const where = { fechaVenta: { gte: fechaDesde, lte: fechaHasta } };

        const [items, total] = await Promise.all([
            this.prisma.venta.findMany({
                where,
                include: {
                    prenda: { include: { categoria: true, talle: true, fotos: { take: 1 } } },
                    cliente: true,
                },
                orderBy: { fechaVenta: 'desc' },
                skip,
                take,
            }),
            this.prisma.venta.count({ where }),
        ]);

        return { items, total, skip, take };
    }

    // ── Ventas sin caja (huérfanas) ──────────────────────────────
    async huerfanas(skip = 0, take = 50) {
        const where = { cajaId: null };
        const [items, total] = await Promise.all([
            this.prisma.venta.findMany({
                where,
                include: {
                    prenda: { include: { categoria: true, talle: true } },
                    cliente: true,
                },
                orderBy: { fechaVenta: 'desc' },
                skip,
                take,
            }),
            this.prisma.venta.count({ where }),
        ]);
        return { items, total, skip, take };
    }

    // ── Anular venta ─────────────────────────────────────────────
    async anular(id: string) {
        const venta = await this.prisma.venta.findUnique({ where: { id } });
        if (!venta) throw new NotFoundException('Venta no encontrada');

        return this.prisma.$transaction(async (tx) => {
            await tx.prenda.update({
                where: { id: venta.prendaId },
                data: { estado: 'DISPONIBLE' },
            });

            // Solo descuenta de caja si era EFECTIVO
            if (venta.cajaId && venta.metodoPago === 'EFECTIVO') {
                await tx.cajaDiaria.update({
                    where: { id: venta.cajaId },
                    data: { montoEsperado: { decrement: venta.precioFinal } },
                });
            }

            if (venta.reservaId) {
                await tx.reserva.update({
                    where: { id: venta.reservaId },
                    data: { estado: 'CANCELADA' },
                });
            }

            await tx.venta.delete({ where: { id } });
            return { ok: true };
        });
    }
}
