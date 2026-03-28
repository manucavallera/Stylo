import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateReservaDto,
    ConfirmarReservaDto,
    ReservaBotDto,
    ConfirmarPorBotDto,
} from './dto/create-reserva.dto';

@Injectable()
export class ReservasService {
    private readonly logger = new Logger(ReservasService.name);
    private readonly n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    constructor(private readonly prisma: PrismaService) { }

    private async notificarN8n(path: string, body: object) {
        if (!this.n8nWebhookUrl) return;
        try {
            await fetch(`${this.n8nWebhookUrl}/${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (err) {
            this.logger.warn(`n8n webhook ${path} falló: ${err.message}`);
        }
    }

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
                include: {
                    prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 }, categoria: true, talle: true } },
                    cliente: true,
                },
            });

            await tx.prenda.update({
                where: { id: dto.prendaId },
                data: { estado: 'RESERVADO' },
            });

            return reserva;
        }).then((reserva) => {
            const horaExpiracion = reserva.fechaExpiracion.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Argentina/Buenos_Aires',
            });
            this.notificarN8n('reserva-creada', {
                telefonoWhatsapp: reserva.cliente.telefonoWhatsapp,
                horaExpiracion,
                fotoUrl: reserva.prenda.fotos[0]?.url ?? null,
            });
            return reserva;
        });
    }

    // ── Confirmar reserva (cliente pagó) ─────────────────────────
    async confirmar(id: string, dto: ConfirmarReservaDto) {
        const reserva = await this.prisma.reserva.findUnique({
            where: { id },
            include: { prenda: true },
        });
        if (!reserva) throw new NotFoundException('Reserva no encontrada');
        if (reserva.estado !== 'ACTIVA') {
            throw new BadRequestException(
                `No se puede confirmar una reserva en estado ${reserva.estado}`,
            );
        }

        // Buscar caja abierta hoy (opcional — si no hay, la venta queda sin caja)
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const cajaAbierta = await this.prisma.cajaDiaria.findFirst({
            where: { fecha: hoy, estado: 'ABIERTA' },
        });

        const reservaConfirmada = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.reserva.update({
                where: { id },
                data: { estado: 'CONFIRMADA', comprobanteUrl: dto.comprobanteUrl },
                include: {
                    prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 } } },
                    cliente: true,
                },
            });

            await tx.prenda.update({
                where: { id: reserva.prendaId },
                data: { estado: 'VENDIDO' },
            });

            await tx.venta.create({
                data: {
                    prendaId: reserva.prendaId,
                    clienteId: reserva.clienteId ?? undefined,
                    reservaId: id,
                    cajaId: cajaAbierta?.id ?? null,
                    precioFinal: reserva.prenda.precioVenta,
                    costoHistoricoArs: reserva.prenda.costoUnitario,
                    metodoPago: 'TRANSFERENCIA',
                    canalVenta: 'ONLINE',
                },
            });

            if (cajaAbierta) {
                await tx.cajaDiaria.update({
                    where: { id: cajaAbierta.id },
                    data: { montoEsperado: { increment: reserva.prenda.precioVenta } },
                });
            }

            return updated;
        });

        // Notificar al cliente por WhatsApp
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE;
        if (evolutionApiUrl && evolutionApiKey && evolutionInstance && reservaConfirmada.cliente?.telefonoWhatsapp) {
            const remoteJid = `${reservaConfirmada.cliente.telefonoWhatsapp}@s.whatsapp.net`;
            const mensaje = `✅ ¡Tu compra fue confirmada!\n\nGabi revisó tu comprobante y todo está en orden. ¡Gracias por tu compra! 🛍️`;
            fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                body: JSON.stringify({ number: remoteJid, text: mensaje }),
            }).catch(() => null);
        }

        return reservaConfirmada;
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
            return { ok: true };
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

    // ── Reservar desde bot de WhatsApp ──────────────────────────
    async reservarDesdeBot(dto: ReservaBotDto) {
        // Upsert cliente por teléfono
        let cliente = await this.prisma.cliente.findFirst({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp },
        });
        if (!cliente) {
            cliente = await this.prisma.cliente.create({
                data: {
                    nombre: dto.nombreCliente || dto.telefonoWhatsapp,
                    telefonoWhatsapp: dto.telefonoWhatsapp,
                },
            });
        }

        // Buscar prenda por código corto (primeros 8 chars del UUID)
        const prenda = await this.prisma.prenda.findFirst({
            where: { id: { startsWith: dto.prendaId } },
        });
        if (!prenda) throw new NotFoundException('Prenda no encontrada');

        return this.create({ prendaId: prenda.id, clienteId: cliente.id });
    }

    // ── Recibir comprobante desde bot (guarda URL, NO confirma la venta) ──
    async recibirComprobante(dto: ConfirmarPorBotDto) {
        const cliente = await this.prisma.cliente.findFirst({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp },
        });
        if (!cliente) return { ok: false };

        const reserva = await this.prisma.reserva.findFirst({
            where: { clienteId: cliente.id, estado: 'ACTIVA' },
            orderBy: { createdAt: 'desc' },
        });
        if (!reserva) return { ok: false };

        await this.prisma.reserva.update({
            where: { id: reserva.id },
            data: { comprobanteUrl: dto.comprobanteUrl },
        });

        return { ok: true };
    }

    // ── Historial de reservas ────────────────────────────────────
    findHistorial() {
        return this.prisma.reserva.findMany({
            where: { estado: { not: 'ACTIVA' } },
            include: { prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 }, categoria: true, talle: true } }, cliente: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }

    // ── Listar reservas activas ──────────────────────────────────
    findActivas() {
        return this.prisma.reserva.findMany({
            where: { estado: 'ACTIVA' },
            include: { prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 }, categoria: true, talle: true } }, cliente: true },
            orderBy: { fechaExpiracion: 'asc' },
        });
    }
}
