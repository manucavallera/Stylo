import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePrendaDto } from './dto/update-prenda.dto';

@Injectable()
export class PrendasService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Listar prendas con filtros opcionales ────────────────────
    findAll(filters?: {
        estado?: string;
        categoriaId?: string;
        talleId?: string;
        fardoId?: string;
    }) {
        return this.prisma.prenda.findMany({
            where: {
                ...(filters?.estado && { estado: filters.estado as any }),
                ...(filters?.categoriaId && { categoriaId: filters.categoriaId }),
                ...(filters?.talleId && { talleId: filters.talleId }),
                ...(filters?.fardoId && { fardoId: filters.fardoId }),
            },
            include: {
                categoria: true,
                talle: true,
                fotos: { orderBy: { orden: 'asc' } },
                fardo: { select: { id: true, fechaCompra: true, moneda: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── Ver una prenda por ID o por QR ──────────────────────────
    async findOne(id: string) {
        const prenda = await this.prisma.prenda.findUnique({
            where: { id },
            include: {
                categoria: true,
                talle: true,
                fotos: { orderBy: { orden: 'asc' } },
                fardo: true,
                reservas: { orderBy: { createdAt: 'desc' }, take: 5 },
                venta: true,
            },
        });
        if (!prenda) throw new NotFoundException(`Prenda ${id} no encontrada`);
        return prenda;
    }

    // ── Escaneo por QR (para el POS) ────────────────────────────
    async findByQr(qrCode: string) {
        const prenda = await this.prisma.prenda.findUnique({
            where: { qrCode },
            include: { categoria: true, talle: true, fotos: true },
        });
        if (!prenda) throw new NotFoundException('QR no reconocido');
        return prenda;
    }

    // ── Actualizar precio y/o estado ────────────────────────────
    async update(id: string, dto: UpdatePrendaDto) {
        await this.findOne(id);
        return this.prisma.prenda.update({ where: { id }, data: dto as any });
    }

    // ── Eliminar prenda ─────────────────────────────────────────
    async remove(id: string) {
        const prenda = await this.findOne(id);
        if (prenda.venta) {
            throw new BadRequestException('No se puede eliminar una prenda que ya fue vendida');
        }
        await this.prisma.prenda.delete({ where: { id } });
    }

    // ── Fotos ────────────────────────────────────────────────────
    async addFoto(prendaId: string, url: string, orden: number) {
        await this.findOne(prendaId);
        return this.prisma.fotoPrenda.create({ data: { prendaId, url, orden } });
    }

    async removeFoto(prendaId: string, fotoId: string) {
        await this.prisma.fotoPrenda.delete({ where: { id: fotoId, prendaId } });
    }

    // ── Clavos: prendas sin vender después de N días ─────────────
    findClavos(diasSinVenta = 30) {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasSinVenta);

        return this.prisma.prenda.findMany({
            where: {
                estado: 'DISPONIBLE',
                createdAt: { lt: fechaLimite },
            },
            include: { categoria: true, talle: true },
            orderBy: { createdAt: 'asc' },
        });
    }
}
