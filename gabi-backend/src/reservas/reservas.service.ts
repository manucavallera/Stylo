import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateReservaDto,
    ConfirmarReservaDto,
} from './dto/create-reserva.dto';

@Injectable()
export class ReservasService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Crear reserva ────────────────────────────────────────────
    async create(dto: CreateReservaDto) {
        // Verificar que la prenda existe y está disponible
        const prenda = await this.prisma.prenda.findUnique({
            where: { id: dto.prendaId },
        });
        if (!prenda) throw new NotFoundException('Prenda no encontrada');
        if (prenda.estado !== 'DISPONIBLE') {
            throw new BadRequestException(
                `La prenda no está disponible (estado: ${prenda.estado})`,
            );
        }

        // Verificar que no hay reserva activa para esta prenda
        const reservaActiva = await this.prisma.reserva.findFirst({
            where: { prendaId: dto.prendaId, estado: 'ACTIVA' },
        });
        if (reservaActiva) {
            throw new BadRequestException('La prenda ya tiene una reserva activa');
        }

        const minutos = dto.minutosExpiracion ?? 20;
        const fechaExpiracion = new Date(Date.now() + minutos * 60 * 1000);

        // Transacción: crear reserva + marcar prenda como RESERVADO
        return this.prisma.$transaction(async (tx) => {
            const reserva = await tx.reserva.create({
                data: {
                    prendaId: dto.prendaId,
                    clienteId: dto.clienteId,
                    fechaExpiracion,
                    estado: 'ACTIVA',
                },
                include: { prenda: true, cliente: true },
            });

            await tx.prenda.update({
                where: { id: dto.prendaId },
                data: { estado: 'RESERVADO' },
            });

            return reserva;
        });
    }

    // ── Confirmar reserva (cliente pagó) ─────────────────────────
    async confirmar(id: string, dto: ConfirmarReservaDto) {
        const reserva = await this.prisma.reserva.findUnique({ where: { id } });
        if (!reserva) throw new NotFoundException('Reserva no encontrada');
        if (reserva.estado !== 'ACTIVA') {
            throw new BadRequestException(
                `No se puede confirmar una reserva en estado ${reserva.estado}`,
            );
        }

        return this.prisma.reserva.update({
            where: { id },
            data: {
                estado: 'CONFIRMADA',
                comprobanteUrl: dto.comprobanteUrl,
            },
        });
    }

    // ── Cancelar manualmente ─────────────────────────────────────
    async cancelar(id: string) {
        const reserva = await this.prisma.reserva.findUnique({ where: { id } });
        if (!reserva) throw new NotFoundException('Reserva no encontrada');
        if (reserva.estado !== 'ACTIVA') {
            throw new BadRequestException(`Solo se pueden cancelar reservas activas (estado actual: ${reserva.estado})`);
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.reserva.update({
                where: { id },
                data: { estado: 'CANCELADA' },
            });
            await tx.prenda.update({
                where: { id: reserva.prendaId },
                data: { estado: 'DISPONIBLE' },
            });
        });
    }

    // ── Expirar reservas vencidas (llamado por cron/n8n) ─────────
    async expirarVencidas() {
        const ahora = new Date();

        const reservasVencidas = await this.prisma.reserva.findMany({
            where: { estado: 'ACTIVA', fechaExpiracion: { lt: ahora } },
        });

        if (reservasVencidas.length === 0) return { expiradas: 0 };

        await this.prisma.$transaction(async (tx) => {
            for (const reserva of reservasVencidas) {
                await tx.reserva.update({
                    where: { id: reserva.id },
                    data: { estado: 'EXPIRADA' },
                });
                await tx.prenda.update({
                    where: { id: reserva.prendaId },
                    data: { estado: 'DISPONIBLE' },
                });
            }
        });

        return { expiradas: reservasVencidas.length };
    }

    // ── Listar reservas activas ──────────────────────────────────
    findActivas() {
        return this.prisma.reserva.findMany({
            where: { estado: 'ACTIVA' },
            include: { prenda: { include: { categoria: true, talle: true } }, cliente: true },
            orderBy: { fechaExpiracion: 'asc' },
        });
    }
}
