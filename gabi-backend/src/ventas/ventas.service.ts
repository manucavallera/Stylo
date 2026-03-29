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
        return this.prisma.$transaction(async (tx) => {
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
                include: { prenda: true, cliente: true, reserva: true },
            });

            // Prenda pasa a VENDIDO
            await tx.prenda.update({
                where: { id: dto.prendaId },
                data: { estado: 'VENDIDO' },
            });

            // Si hay caja abierta, sumar la venta al monto esperado
            if (dto.cajaId) {
                await tx.cajaDiaria.update({
                    where: { id: dto.cajaId },
                    data: {
                        montoEsperado: {
                            increment: dto.precioFinal,
                        },
                    },
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
}
