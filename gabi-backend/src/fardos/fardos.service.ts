import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFardoDto } from './dto/create-fardo.dto';
import { AbrirFardoDto } from './dto/abrir-fardo.dto';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';

@Injectable()
export class FardosService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Registrar compra de fardo ────────────────────────────────
    create(dto: CreateFardoDto) {
        return this.prisma.fardo.create({
            data: {
                proveedorId: dto.proveedorId,
                fechaCompra: new Date(dto.fechaCompra),
                costoTotal: dto.costoTotal,
                moneda: dto.moneda,
                pesoKg: dto.pesoKg,
                notas: dto.notas,
                estado: 'PENDIENTE_APERTURA',
            },
            include: { proveedor: true },
        });
    }

    // ── Listar todos los fardos ──────────────────────────────────
    findAll() {
        return this.prisma.fardo.findMany({
            include: { proveedor: true },
            orderBy: { fechaCompra: 'desc' },
        });
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

        // Total de prendas que entran
        const totalPrendas = dto.items.reduce(
            (sum, item) => sum + item.cantidad,
            0,
        );

        // Costo unitario = costo total del fardo / total de prendas
        // Siempre en ARS. Si fue comprado en USD, Gabi ingresa el equivalente en ARS.
        const costoUnitario = Number(fardo.costoTotal) / totalPrendas;

        // Generar IDs y QRs ANTES de la transacción para no bloquearla
        const prendaData: any[] = [];
        for (const item of dto.items) {
            for (let i = 0; i < item.cantidad; i++) {
                const prendaId = uuidv4();
                const qrCode = await QRCode.toDataURL(prendaId, { width: 200, margin: 1 });
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
        const costoFardo = Number(fardo.costoTotal);
        const ganancia = totalVendido - costoFardo;
        const roi = costoFardo > 0 ? (ganancia / costoFardo) * 100 : 0;

        return {
            fardoId: id,
            costoFardo,
            moneda: fardo.moneda,
            totalPrendas: fardo.totalPrendas,
            prendasVendidas: ventas.length,
            totalVendido,
            ganancia,
            roi: Math.round(roi * 100) / 100, // 2 decimales
        };
    }
}
