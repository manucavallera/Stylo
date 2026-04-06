import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GruposWhatsappService } from '../grupos-whatsapp/grupos-whatsapp.service';
import { CreateFardoDto } from './dto/create-fardo.dto';
import { AbrirFardoDto } from './dto/abrir-fardo.dto';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';

@Injectable()
export class FardosService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gruposService: GruposWhatsappService,
    ) { }

    // ── Registrar compra de fardo ────────────────────────────────
    create(dto: CreateFardoDto) {
        return this.prisma.fardo.create({
            data: {
                nombre: dto.nombre,
                proveedorId: dto.proveedorId,
                fechaCompra: new Date(dto.fechaCompra),
                costoTotal: dto.costoTotal,
                moneda: dto.moneda,
                tipoCambio: dto.tipoCambio,
                pesoKg: dto.pesoKg,
                notas: dto.notas,
                estado: 'PENDIENTE_APERTURA',
            },
            include: { proveedor: true },
        });
    }

    // ── Listar fardos activos (sin CERRADO) ─────────────────────
    findAll() {
        return this.prisma.fardo.findMany({
            where: { estado: { not: 'CERRADO' } },
            include: { proveedor: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── Historial de fardos cerrados ─────────────────────────────
    findHistorial() {
        return this.prisma.fardo.findMany({
            where: { estado: 'CERRADO' },
            include: { proveedor: true },
            orderBy: { updatedAt: 'desc' },
            take: 30,
        });
    }

    // ── Cerrar fardo ─────────────────────────────────────────────
    async cerrar(id: string) {
        const fardo = await this.findOne(id);
        if (fardo.estado !== 'ABIERTO') {
            throw new BadRequestException('Solo se pueden cerrar fardos ABIERTOS');
        }
        return this.prisma.$transaction([
            this.prisma.prenda.updateMany({
                where: { fardoId: id, estado: 'DISPONIBLE' },
                data: { estado: 'RETIRADO' },
            }),
            this.prisma.fardo.update({
                where: { id },
                data: { estado: 'CERRADO' },
            }),
        ]);
    }

    // ── Eliminar fardo (solo PENDIENTE_APERTURA) ─────────────────
    async remove(id: string) {
        const fardo = await this.findOne(id);
        if (fardo.estado !== 'PENDIENTE_APERTURA') {
            throw new BadRequestException('Solo se pueden eliminar fardos que no fueron abiertos');
        }
        return this.prisma.fardo.delete({ where: { id } });
    }

    // ── Ver un fardo con todas sus prendas ───────────────────────
    async findOne(id: string) {
        const fardo = await this.prisma.fardo.findUnique({
            where: { id },
            include: {
                proveedor: true,
                prendas: {
                    include: { categoria: true, talle: true, fotos: true },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!fardo) throw new NotFoundException(`Fardo ${id} no encontrado`);
        return fardo;
    }

    // ── APERTURA DE FARDO ────────────────────────────────────────
    // Lógica clave: carga masiva + cálculo automático de costo unitario
    async abrirFardo(id: string, dto: AbrirFardoDto) {
        const fardo = await this.findOne(id);

        if (fardo.estado === 'CERRADO') {
            throw new BadRequestException('Este fardo ya fue cerrado y procesado');
        }

        if (fardo.estado === 'ABIERTO') {
            throw new BadRequestException('Este fardo ya fue abierto. No se puede abrir dos veces');
        }

        // Total de prendas que entran
        const totalPrendas = dto.items.reduce(
            (sum, item) => sum + item.cantidad,
            0,
        );

        if (totalPrendas === 0) {
            throw new BadRequestException('Debés ingresar al menos una prenda para abrir el fardo');
        }

        // Costo unitario = costo total del fardo / total de prendas (siempre en ARS)
        // Si el fardo es USD, convertir con tipoCambio antes de dividir
        const costoBase =
            fardo.moneda === 'USD' && fardo.tipoCambio
                ? Number(fardo.costoTotal) * Number(fardo.tipoCambio)
                : Number(fardo.costoTotal);
        const costoUnitario = costoBase / totalPrendas;

        // Generar IDs y QRs ANTES de la transacción para no bloquearla
        const prendaData: any[] = [];
        for (const item of dto.items) {
            for (let i = 0; i < item.cantidad; i++) {
                const prendaId = uuidv4();
                const frontendUrl = process.env.FRONTEND_URL || 'https://americano-stylo.gygo4l.easypanel.host';
                const qrCode = await QRCode.toDataURL(`${frontendUrl}/p/${prendaId}`, { width: 200, margin: 1 });
                prendaData.push({
                    id: prendaId,
                    fardoId: id,
                    categoriaId: item.categoriaId,
                    talleId: item.talleId,
                    costoUnitario,
                    precioVenta: item.tieneFalla
                        ? item.precioVenta * 0.6  // -40% automático en fallas
                        : item.precioVenta,
                    estado: item.tieneFalla ? 'FALLA' : 'DISPONIBLE',
                    tieneFalla: item.tieneFalla ?? false,
                    descripcionFalla: item.descripcionFalla ?? null,
                    qrCode,
                });
            }
        }

        // Transacción solo con escrituras a la DB (rápido, sin I/O externa)
        const prendas = await this.prisma.$transaction([
            ...prendaData.map(data => this.prisma.prenda.create({ data })),
            this.prisma.fardo.update({
                where: { id },
                data: { totalPrendas: { increment: totalPrendas }, estado: 'ABIERTO' },
            }),
        ]);

        // El array transaction devuelve [prenda1, prenda2, ..., fardoActualizado]
        const prendasCreadas = prendas.slice(0, prendaData.length);

        return {
            fardoId: id,
            totalPrendas,
            costoUnitarioCalculado: costoUnitario,
            prendasCreadas: prendasCreadas.length,
            prendas: prendasCreadas,
        };
    }

    // ── Publicar prendas al grupo de WhatsApp ───────────────────
    async publicarAlGrupo(id: string, includeSinFoto = false) {
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE || 'manu';

        if (!evolutionApiUrl || !evolutionApiKey) {
            throw new BadRequestException('Faltan variables de entorno: EVOLUTION_API_URL o EVOLUTION_API_KEY');
        }

        const grupos = await this.gruposService.findActivos();
        if (grupos.length === 0) {
            throw new BadRequestException('No hay grupos de WhatsApp activos configurados. Agregalos en Configuración → Grupos WA.');
        }

        const fardo = await this.findOne(id);
        const prendas: any[] = fardo.prendas;

        const conFoto = prendas.filter(p => p.estado === 'DISPONIBLE' && p.fotos?.length > 0);
        const sinFotoList = prendas.filter(p => p.estado === 'DISPONIBLE' && !p.fotos?.length);
        const sinFoto = sinFotoList.length;

        let enviadas = 0;
        const errores: string[] = [];

        for (const prenda of conFoto) {
            const foto = prenda.fotos[0];
            const categoria = prenda.categoria?.nombre || '';
            const talle = prenda.talle?.nombre || '';
            const precio = Number(prenda.precioVenta).toLocaleString('es-AR');
            const codigo = prenda.id.substring(0, 8);
            const desc = [categoria, talle].filter(Boolean).join(' — Talle ');
            const codigoInvisible = codigo.split('').map(c => ({ '0':'\u200B\u200B\u200B\u200B','1':'\u200B\u200B\u200B\u200C','2':'\u200B\u200B\u200C\u200B','3':'\u200B\u200B\u200C\u200C','4':'\u200B\u200C\u200B\u200B','5':'\u200B\u200C\u200B\u200C','6':'\u200B\u200C\u200C\u200B','7':'\u200B\u200C\u200C\u200C','8':'\u200C\u200B\u200B\u200B','9':'\u200C\u200B\u200B\u200C','a':'\u200C\u200B\u200C\u200B','b':'\u200C\u200B\u200C\u200C','c':'\u200C\u200C\u200B\u200B','d':'\u200C\u200C\u200B\u200C','e':'\u200C\u200C\u200C\u200B','f':'\u200C\u200C\u200C\u200C' }[c] || '')).join('');
            const notaLinea = prenda.nota ? `📝 ${prenda.nota}\n` : '';
            const caption =
                `${desc || 'Prenda'}\n` +
                `${notaLinea}` +
                `💰 $${precio}\n` +
                `📲 Reenviá esta foto al número de la tienda para reservar${codigoInvisible}`;

            // Descargar imagen en el backend para evitar que Evolution API resuelva DNS de Supabase
            let mediaBase64: string | null = null;
            try {
                const imgRes = await fetch(foto.url);
                if (imgRes.ok) {
                    const buffer = await imgRes.arrayBuffer();
                    mediaBase64 = Buffer.from(buffer).toString('base64');
                }
            } catch { /* si falla la descarga, usamos la URL como fallback */ }

            for (const grupo of grupos) {
                try {
                    const res = await fetch(
                        `${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                            body: JSON.stringify({
                                number: grupo.groupId,
                                mediatype: 'image',
                                mimetype: 'image/jpeg',
                                media: mediaBase64 ?? foto.url,
                                caption,
                                fileName: 'prenda.jpg',
                            }),
                        },
                    );
                    if (!res.ok) {
                        const texto = await res.text();
                        errores.push(`${prenda.id} → ${grupo.nombre}: ${texto}`);
                    }
                } catch (err: any) {
                    errores.push(`${prenda.id} → ${grupo.nombre}: ${err.message}`);
                }
            }
            enviadas++;
        }

        // Prendas sin foto: enviar solo texto si includeSinFoto=true
        if (includeSinFoto && sinFotoList.length > 0) {
            for (const prenda of sinFotoList) {
                const categoria = prenda.categoria?.nombre || '';
                const talle = prenda.talle?.nombre || '';
                const precio = Number(prenda.precioVenta).toLocaleString('es-AR');
                const notaLinea = prenda.nota ? `📝 ${prenda.nota}\n` : '';
                const desc = [categoria, talle].filter(Boolean).join(' — Talle ');
                const texto =
                    `${desc || 'Prenda'}\n` +
                    `${notaLinea}` +
                    `💰 $${precio}\n` +
                    `📲 Escribinos para reservar`;

                for (const grupo of grupos) {
                    try {
                        const res = await fetch(
                            `${evolutionApiUrl}/message/sendText/${evolutionInstance}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                                body: JSON.stringify({ number: grupo.groupId, text: texto }),
                            },
                        );
                        if (!res.ok) {
                            const texto = await res.text();
                            errores.push(`${prenda.id} (sin foto) → ${grupo.nombre}: ${texto}`);
                        }
                    } catch (err: any) {
                        errores.push(`${prenda.id} (sin foto) → ${grupo.nombre}: ${err.message}`);
                    }
                }
                enviadas++;
            }
        }

        return { enviadas, sinFoto: includeSinFoto ? 0 : sinFoto, errores };
    }

    // ── ROI del fardo (Analytics básico) ────────────────────────
    async getRoi(id: string) {
        const fardo = await this.findOne(id);

        const ventas = await this.prisma.venta.findMany({
            where: { prenda: { fardoId: id } },
            select: { precioFinal: true, costoHistoricoArs: true },
        });

        const totalVendido = ventas.reduce(
            (sum, v) => sum + Number(v.precioFinal),
            0,
        );
        // Siempre comparar en ARS: si el fardo es USD, convertir con tipoCambio
        const costoFardoArs =
            fardo.moneda === 'USD' && fardo.tipoCambio
                ? Number(fardo.costoTotal) * Number(fardo.tipoCambio)
                : Number(fardo.costoTotal);
        const ganancia = totalVendido - costoFardoArs;
        const roi = costoFardoArs > 0 ? (ganancia / costoFardoArs) * 100 : 0;

        return {
            fardoId: id,
            costoFardo: costoFardoArs,
            moneda: fardo.moneda,
            totalPrendas: fardo.totalPrendas,
            prendasVendidas: ventas.length,
            totalVendido,
            ganancia,
            roi: Math.round(roi * 100) / 100, // 2 decimales
        };
    }
}
