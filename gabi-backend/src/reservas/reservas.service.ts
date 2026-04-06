import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
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

    constructor(
        private readonly prisma: PrismaService,
        private readonly configuracionService: ConfiguracionService,
    ) { }

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

    private async analizarComprobante(imageUrl: string, precioPrenda: number) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return null;

        try {
            const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
            if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const rawType = imgRes.headers.get('content-type') ?? 'image/jpeg';
            const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp']
                .find(t => rawType.includes(t)) ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

            const client = new Anthropic({ apiKey });
            const response = await client.messages.create({
                model: 'claude-haiku-4-5',
                max_tokens: 256,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: mediaType, data: base64 },
                        },
                        {
                            type: 'text',
                            text: 'Analizá este comprobante de transferencia bancaria argentina. Extraé: monto (número entero sin separadores), alias o CVU del destinatario, fecha y hora de la operación, nombre del banco o billetera. Respondé SOLO con JSON válido sin texto extra: {"monto": number|null, "alias": string|null, "fecha": string|null, "banco": string|null}',
                        },
                    ],
                }],
            });

            const textBlock = response.content.find(b => b.type === 'text');
            if (!textBlock || textBlock.type !== 'text') return null;

            const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            const data = JSON.parse(jsonMatch[0]);
            const monto = typeof data.monto === 'number' ? data.monto : null;
            const coincide = monto !== null ? Math.round(monto) === Math.round(precioPrenda) : null;

            return {
                monto,
                alias: data.alias ?? null,
                fecha: data.fecha ?? null,
                banco: data.banco ?? null,
                coincide,
            };
        } catch (err: any) {
            this.logger.warn(`Claude Vision falló: ${err.message}`);
            return null;
        }
    }

    private notificarGabi(mensaje: string) {
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE;
        const gabiNumero = process.env.GABI_WHATSAPP;
        if (!evolutionApiUrl || !evolutionApiKey || !gabiNumero) return;

        const remoteJid = `${gabiNumero}@s.whatsapp.net`;
        fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
            body: JSON.stringify({ number: remoteJid, text: mensaje }),
        }).catch((err) => this.logger.warn(`notificarGabi falló: ${err.message}`));
    }

    // ── Crear reserva ────────────────────────────────────────────
    async create(dto: CreateReservaDto) {
        // Verificar que la prenda existe
        const prenda = await this.prisma.prenda.findUnique({
            where: { id: dto.prendaId },
        });
        if (!prenda) throw new NotFoundException('Prenda no encontrada');

        const minutos = dto.minutosExpiracion ?? 20;
        const fechaExpiracion = new Date(Date.now() + minutos * 60 * 1000);

        // Transacción atómica: el update de prenda solo ocurre si está DISPONIBLE,
        // eliminando la race condition entre el check y la escritura.
        return this.prisma.$transaction(async (tx) => {
            // Actualizar prenda solo si sigue DISPONIBLE — atómico
            const updated = await tx.prenda.updateMany({
                where: { id: dto.prendaId, estado: 'DISPONIBLE' },
                data: { estado: 'RESERVADO' },
            });

            if (updated.count === 0) {
                throw new BadRequestException(
                    'Esta prenda ya está reservada o no está disponible',
                );
            }

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
        const reserva = await this.prisma.reserva.findUnique({
            where: { id },
            include: {
                cliente: true,
                prenda: { include: { categoria: true, talle: true } },
            },
        });
        if (!reserva) throw new NotFoundException('Reserva no encontrada');
        if (reserva.estado !== 'ACTIVA') {
            throw new BadRequestException(`Solo se pueden cancelar reservas activas (estado actual: ${reserva.estado})`);
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.reserva.update({
                where: { id },
                data: { estado: 'CANCELADA' },
            });
            await tx.prenda.update({
                where: { id: reserva.prendaId },
                data: { estado: 'DISPONIBLE' },
            });
        });

        // Notificar a la clienta si tiene número de WhatsApp
        if (reserva.cliente?.telefonoWhatsapp) {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const evolutionApiKey = process.env.EVOLUTION_API_KEY;
            const evolutionInstance = process.env.EVOLUTION_INSTANCE;
            if (evolutionApiUrl && evolutionApiKey) {
                const categoria = reserva.prenda.categoria?.nombre ?? '';
                const talle = reserva.prenda.talle?.nombre ?? '';
                const desc = [categoria, talle].filter(Boolean).join(' — Talle ') || 'tu prenda';
                const remoteJid = `${reserva.cliente.telefonoWhatsapp}@s.whatsapp.net`;
                fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                    body: JSON.stringify({
                        number: remoteJid,
                        text: `❌ Tu reserva de ${desc} fue cancelada.\n\nSi tenés alguna pregunta, escribinos. 😊`,
                    }),
                }).catch(() => null);
            }
        }

        return { ok: true };
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

        const config = await this.configuracionService.getConfig();
        const reserva = await this.create({ prendaId: prenda.id, clienteId: cliente.id, minutosExpiracion: config.minutosReserva });

        // Notificar a Gabi que llegó una reserva nueva por el bot
        const horaExp = reserva.fechaExpiracion.toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
        });
        const categoria = reserva.prenda.categoria?.nombre ?? '';
        const talle = reserva.prenda.talle?.nombre ?? '';
        const precio = Number(reserva.prenda.precioVenta).toLocaleString('es-AR');
        this.notificarGabi(
            `🛍️ *Nueva reserva (bot)*\n` +
            `Prenda: ${[categoria, talle].filter(Boolean).join(' — Talle ') || 'Sin categoría'}\n` +
            `Precio: $${precio}\n` +
            `Cliente: ${dto.telefonoWhatsapp}\n` +
            `Vence: ${horaExp}hs\n\n` +
            `Entrá a Reservas para confirmar cuando pague.`,
        );

        return reserva;
    }

    // ── Recibir comprobante desde bot (guarda URL, NO confirma la venta) ──
    async recibirComprobante(dto: ConfirmarPorBotDto) {
        const cliente = await this.prisma.cliente.findFirst({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp },
        });
        if (!cliente) return { ok: false };

        const reserva = await this.prisma.reserva.findFirst({
            where: { clienteId: cliente.id, estado: 'ACTIVA' },
            include: { prenda: { include: { categoria: true, talle: true } } },
            orderBy: { createdAt: 'desc' },
        });
        if (!reserva) return { ok: false };

        await this.prisma.reserva.update({
            where: { id: reserva.id },
            data: { comprobanteUrl: dto.comprobanteUrl },
        });

        // Analizar comprobante con Claude Vision (fire-and-forget con resultado)
        const precio = Number(reserva.prenda.precioVenta);
        const categoria = reserva.prenda.categoria?.nombre ?? '';
        const talle = reserva.prenda.talle?.nombre ?? '';
        const descPrenda = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Prenda';

        const analisis = dto.comprobanteUrl
            ? await this.analizarComprobante(dto.comprobanteUrl, precio)
            : null;

        // Armar WA a Gabi con el análisis
        let mensajeGabi =
            `📸 *Comprobante recibido*\n` +
            `Cliente: ${dto.telefonoWhatsapp}\n` +
            `Prenda: ${descPrenda} — $${precio.toLocaleString('es-AR')}\n`;

        if (analisis) {
            const montoStr = analisis.monto?.toLocaleString('es-AR') ?? '?';
            const estadoMonto = analisis.coincide === true
                ? `✅ $${montoStr} — coincide`
                : analisis.coincide === false
                    ? `⚠️ $${montoStr} — NO coincide (esperado $${precio.toLocaleString('es-AR')})`
                    : `$${montoStr}`;

            mensajeGabi += `\n💰 Monto: ${estadoMonto}`;
            if (analisis.banco) mensajeGabi += `\n🏦 ${analisis.banco}`;
            if (analisis.fecha) mensajeGabi += `\n📅 ${analisis.fecha}`;
            if (analisis.alias) mensajeGabi += `\n🔑 ${analisis.alias}`;
        } else {
            mensajeGabi += `\n_(No se pudo analizar la imagen)_`;
        }

        mensajeGabi += `\n\nEntrá a Reservas para confirmar el pago.`;

        // Enviar imagen del comprobante + texto a Gabi
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE;
        const gabiNumero = process.env.GABI_WHATSAPP;
        if (evolutionApiUrl && evolutionApiKey && gabiNumero && dto.comprobanteUrl) {
            const remoteJid = `${gabiNumero}@s.whatsapp.net`;
            fetch(`${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                body: JSON.stringify({
                    number: remoteJid,
                    mediatype: 'image',
                    mimetype: 'image/jpeg',
                    media: dto.comprobanteUrl,
                    caption: mensajeGabi,
                    fileName: 'comprobante.jpg',
                }),
            }).catch((err) => this.logger.warn(`sendMedia a Gabi falló: ${err.message}`));
        } else {
            this.notificarGabi(mensajeGabi);
        }

        return { ok: true };
    }

    // ── Confirmar múltiples reservas juntas (un solo WA al cliente) ──
    async confirmarMultiple(ids: string[], comprobanteUrl?: string) {
        if (!ids.length) throw new BadRequestException('No se enviaron IDs de reservas');

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const cajaAbierta = await this.prisma.cajaDiaria.findFirst({
            where: { fecha: hoy, estado: 'ABIERTA' },
        });

        const confirmadas: Array<{ desc: string; precio: number }> = [];

        await this.prisma.$transaction(async (tx) => {
            for (const id of ids) {
                const reserva = await tx.reserva.findUnique({
                    where: { id },
                    include: { prenda: { include: { categoria: true, talle: true } } },
                });
                if (!reserva || reserva.estado !== 'ACTIVA') continue;

                await tx.reserva.update({
                    where: { id },
                    data: { estado: 'CONFIRMADA', comprobanteUrl: comprobanteUrl ?? undefined },
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

                const categoria = reserva.prenda.categoria?.nombre ?? '';
                const talle = reserva.prenda.talle?.nombre ?? '';
                const desc = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Sin categoría';
                confirmadas.push({ desc, precio: Number(reserva.prenda.precioVenta) });
            }
        }, { timeout: 30000, maxWait: 10000 });

        if (confirmadas.length === 0) throw new BadRequestException('No se pudo confirmar ninguna reserva');

        // Buscar teléfono del cliente para el WA (de la primera reserva)
        const primeraReserva = await this.prisma.reserva.findUnique({
            where: { id: ids[0] },
            include: { cliente: true },
        });
        const telefono = primeraReserva?.cliente?.telefonoWhatsapp;

        if (telefono) {
            const evolutionApiUrl = process.env.EVOLUTION_API_URL;
            const evolutionApiKey = process.env.EVOLUTION_API_KEY;
            const evolutionInstance = process.env.EVOLUTION_INSTANCE;
            if (evolutionApiUrl && evolutionApiKey && evolutionInstance) {
                const lista = confirmadas.map(c => `• ${c.desc}`).join('\n');
                const total = confirmadas.reduce((sum, c) => sum + c.precio, 0);
                const remoteJid = `${telefono}@s.whatsapp.net`;
                const mensaje = confirmadas.length === 1
                    ? `✅ ¡Tu compra fue confirmada!\n\nGabi revisó tu comprobante y todo está en orden. ¡Gracias por tu compra! 🛍️`
                    : `✅ ¡Tus ${confirmadas.length} compras fueron confirmadas!\n\n${lista}\n\n💰 Total: $${total.toLocaleString('es-AR')}\n\nGabi revisó tu comprobante y todo está en orden. ¡Gracias por tu compra! 🛍️`;
                fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                    body: JSON.stringify({ number: remoteJid, text: mensaje }),
                }).catch(() => null);
            }
        }

        return { confirmadas: confirmadas.length, detalle: confirmadas };
    }

    // ── Agregar prenda al carrito bot ───────────────────────────
    async agregarAlCarritoBot(dto: { telefonoWhatsapp: string; prendaId: string }) {
        // Buscar prenda por código corto — sin filtrar por estado para dar mensaje preciso
        const prenda = await this.prisma.prenda.findFirst({
            where: { id: { startsWith: dto.prendaId } },
            include: { categoria: true, talle: true, reservas: { where: { estado: 'ACTIVA' }, take: 1 } },
        });
        if (!prenda) {
            return { ok: false, estado: 'NO_ENCONTRADA' };
        }
        if (prenda.estado === 'VENDIDO' || prenda.estado === 'RETIRADO') {
            return { ok: false, estado: prenda.estado };
        }
        if (prenda.estado === 'RESERVADO') {
            const reservaActiva = prenda.reservas[0];
            const horaExpiracion = reservaActiva
                ? reservaActiva.fechaExpiracion.toLocaleTimeString('es-AR', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
                  })
                : null;
            return { ok: false, estado: 'RESERVADO', horaExpiracion };
        }

        // Verificar que no esté ya en el carrito de este cliente
        const yaEnCarrito = await this.prisma.carritoBot.findFirst({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp, prendaId: prenda.id },
        });
        if (yaEnCarrito) {
            // Contar el carrito actual y responder como si la hubiera agregado
            const total = await this.prisma.carritoBot.count({
                where: { telefonoWhatsapp: dto.telefonoWhatsapp },
            });
            const categoria = prenda.categoria?.nombre ?? '';
            const talle = prenda.talle?.nombre ?? '';
            const desc = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Sin categoría';
            return { ok: true, desc, totalEnCarrito: total, yaEstabaEnCarrito: true };
        }

        await this.prisma.carritoBot.create({
            data: { telefonoWhatsapp: dto.telefonoWhatsapp, prendaId: prenda.id },
        });

        const total = await this.prisma.carritoBot.count({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp },
        });

        const categoria = prenda.categoria?.nombre ?? '';
        const talle = prenda.talle?.nombre ?? '';
        const desc = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Sin categoría';

        return { ok: true, desc, totalEnCarrito: total, yaEstabaEnCarrito: false };
    }

    // ── Confirmar carrito bot (reserva todas las prendas) ────────
    async confirmarCarritoBot(dto: { telefonoWhatsapp: string; nombreCliente?: string }) {
        const items = await this.prisma.carritoBot.findMany({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp },
            include: { prenda: { include: { categoria: true, talle: true } } },
        });

        if (items.length === 0) {
            throw new BadRequestException('No tenés prendas en el carrito. Mandá fotos primero 😊');
        }

        // Upsert cliente
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

        const config = await this.configuracionService.getConfig();
        const resultados: Array<{ desc: string; precio: number; ok: boolean; horaExpiracion?: string; motivo?: string }> = [];

        for (const item of items) {
            const categoria = item.prenda.categoria?.nombre ?? '';
            const talle = item.prenda.talle?.nombre ?? '';
            const desc = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Sin categoría';
            const precio = Number(item.prenda.precioVenta);
            try {
                const reserva = await this.create({
                    prendaId: item.prendaId,
                    clienteId: cliente.id,
                    minutosExpiracion: config.minutosReserva,
                });
                const horaExpiracion = reserva.fechaExpiracion.toLocaleTimeString('es-AR', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
                });
                resultados.push({ desc, precio, ok: true, horaExpiracion });
            } catch (err: any) {
                resultados.push({ desc, precio, ok: false, motivo: err.message ?? 'No disponible' });
            }
        }

        // Limpiar carrito
        await this.prisma.carritoBot.deleteMany({
            where: { telefonoWhatsapp: dto.telefonoWhatsapp },
        });

        const reservadas = resultados.filter(r => r.ok);
        const fallidas = resultados.filter(r => !r.ok);

        // Notificar a Gabi con lista y monto total
        if (reservadas.length > 0) {
            const lista = reservadas.map(r => `• ${r.desc} — $${r.precio.toLocaleString('es-AR')}`).join('\n');
            const total = reservadas.reduce((sum, r) => sum + r.precio, 0);
            this.notificarGabi(
                `🛒 *Carrito confirmado (bot)*\n` +
                `Cliente: ${dto.telefonoWhatsapp}\n` +
                `Prendas reservadas:\n${lista}\n` +
                `💰 Total: $${total.toLocaleString('es-AR')}\n\n` +
                `Entrá a Reservas para confirmar cuando paguen.`,
            );
        }

        return { reservadas: reservadas.length, fallidas: fallidas.length, detalle: resultados };
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
