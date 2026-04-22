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

    private async analizarComprobante(
        imageSource: { url: string } | { base64: string; mimeType?: string },
        precioPrenda: number,
    ) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return null;

        try {
            let base64: string;
            let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

            if ('base64' in imageSource) {
                // Viene con base64 directo (puede incluir el prefijo data:...)
                const raw = imageSource.base64.replace(/^data:[^;]+;base64,/, '');
                base64 = raw;
                const mt = imageSource.mimeType ?? 'image/jpeg';
                mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp']
                    .find(t => mt.includes(t)) ?? 'image/jpeg') as typeof mediaType;
            } else {
                const imgRes = await fetch(imageSource.url, { signal: AbortSignal.timeout(10000) });
                if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
                const buffer = await imgRes.arrayBuffer();
                base64 = Buffer.from(buffer).toString('base64');
                const rawType = imgRes.headers.get('content-type') ?? 'image/jpeg';
                mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp']
                    .find(t => rawType.includes(t)) ?? 'image/jpeg') as typeof mediaType;
            }

            const client = new Anthropic({ apiKey });
            const response = await client.messages.create({
                model: 'claude-haiku-4-5',
                max_tokens: 512,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: mediaType, data: base64 },
                        },
                        {
                            type: 'text',
                            text: 'Analizá este comprobante de transferencia bancaria argentina. Extraé todos los datos visibles. IMPORTANTE: alias y cvu deben ser del DESTINATARIO (sección "Para"), NO del remitente (sección "De"). Para estadoOperacion usá: "aprobada" si dice aprobada/acreditada/exitosa/confirmada, "pendiente" si dice pendiente/en proceso, "rechazada" si dice rechazada/fallida/error. Respondé SOLO con JSON válido sin texto extra: {"monto": number|null, "alias": string|null, "cvu": string|null, "fecha": string|null, "hora": string|null, "banco": string|null, "nombreRemitente": string|null, "nombreDestinatario": string|null, "nroOperacion": string|null, "tipoTransferencia": string|null, "estadoOperacion": string|null}',
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
                coincide,
                alias: data.alias ?? null,
                cvu: data.cvu ?? null,
                fecha: data.fecha ?? null,
                hora: data.hora ?? null,
                banco: data.banco ?? null,
                nombreRemitente: data.nombreRemitente ?? null,
                nombreDestinatario: data.nombreDestinatario ?? null,
                nroOperacion: data.nroOperacion ?? null,
                tipoTransferencia: data.tipoTransferencia ?? null,
                estadoOperacion: data.estadoOperacion ?? null,
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

        // Notificar al grupo de WA
        if (evolutionApiUrl && evolutionApiKey && evolutionInstance) {
            const grupos = await this.prisma.grupoWhatsapp.findMany({ where: { activo: true } });
            if (grupos.length > 0) {
                const prenda = await this.prisma.prenda.findUnique({
                    where: { id: reserva.prendaId },
                    include: {
                        categoria: true,
                        talle: true,
                        fotos: { take: 1, orderBy: { orden: 'asc' } },
                    },
                });
                const categoria = prenda?.categoria?.nombre ?? '';
                const talle = prenda?.talle?.nombre ?? '';
                const desc = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Sin categoría';
                const precio = Number(reserva.prenda.precioVenta).toLocaleString('es-AR');
                const lineas = [`🔴 *VENDIDO*`, desc, `💰 $${precio}`];
                if (prenda?.tieneFalla) lineas.push(`⚠️ Falla: ${prenda.descripcionFalla ?? 'sí'}`);
                if (prenda?.nota) lineas.push(`📝 ${prenda.nota}`);
                const mensajeGrupo = lineas.join('\n');
                const fotoUrl = prenda?.fotos?.[0]?.url;

                if (fotoUrl) {
                    let mediaBase64: string | null = null;
                    try {
                        const imgRes = await fetch(fotoUrl);
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            mediaBase64 = Buffer.from(buffer).toString('base64');
                        }
                    } catch { /* fallback a URL */ }

                    Promise.allSettled(
                        grupos.map(grupo =>
                            fetch(`${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                                body: JSON.stringify({
                                    number: grupo.groupId,
                                    mediatype: 'image',
                                    mimetype: 'image/jpeg',
                                    media: mediaBase64 ?? fotoUrl,
                                    caption: mensajeGrupo,
                                    fileName: 'prenda.jpg',
                                }),
                            }),
                        ),
                    ).catch(() => null);
                } else {
                    Promise.allSettled(
                        grupos.map(grupo =>
                            fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                                body: JSON.stringify({ number: grupo.groupId, text: mensajeGrupo }),
                            }),
                        ),
                    ).catch(() => null);
                }
            }
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
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE || 'manu';

        const reservasVencidas = await this.prisma.reserva.findMany({
            where: { estado: 'ACTIVA', fechaExpiracion: { lt: ahora } },
            include: { cliente: true, prenda: { include: { categoria: true, talle: true, fotos: { orderBy: { orden: 'asc' }, take: 1 } } } },
        });

        if (reservasVencidas.length === 0) return { expiradas: 0 };

        await this.prisma.$transaction(async (tx) => {
            for (const reserva of reservasVencidas) {
                await tx.reserva.update({ where: { id: reserva.id }, data: { estado: 'EXPIRADA' } });
                await tx.prenda.update({ where: { id: reserva.prendaId }, data: { estado: 'DISPONIBLE' } });
            }
        });

        // Notificar al cliente por WhatsApp
        if (evolutionApiUrl && evolutionApiKey) {
            for (const reserva of reservasVencidas) {
                const tel = reserva.cliente?.telefonoWhatsapp;
                if (!tel) continue;
                const desc = [reserva.prenda.categoria?.nombre, reserva.prenda.talle?.nombre].filter(Boolean).join(' — Talle ') || 'la prenda';
                const fotoUrl = reserva.prenda.fotos?.[0]?.url;
                const mensaje = `⏰ Tu reserva de *${desc}* expiró. La prenda volvió al catálogo. Si todavía la querés, mandá la foto de nuevo para reservarla 😊`;
                if (fotoUrl) {
                    fetch(`${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                        body: JSON.stringify({ number: tel, mediatype: 'image', mimetype: 'image/jpeg', media: fotoUrl, caption: mensaje, fileName: 'prenda.jpg' }),
                    }).catch(() => null);
                } else {
                    fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                        body: JSON.stringify({ number: tel, text: mensaje }),
                    }).catch(() => null);
                }
            }
        }

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

        // Analizar comprobante con Claude Vision
        const precio = Number(reserva.prenda.precioVenta);
        const categoria = reserva.prenda.categoria?.nombre ?? '';
        const talle = reserva.prenda.talle?.nombre ?? '';
        const descPrenda = [categoria, talle].filter(Boolean).join(' — Talle ') || 'Prenda';
        const config = await this.configuracionService.getConfig();

        const imagenSource = dto.comprobanteBase64
            ? { base64: dto.comprobanteBase64, mimeType: dto.comprobanteMimeType }
            : dto.comprobanteUrl
                ? { url: dto.comprobanteUrl }
                : null;

        const analisis = imagenSource
            ? await this.analizarComprobante(imagenSource, precio)
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

            // Validar estado de la operación
            if (analisis.estadoOperacion) {
                const estadoOp = analisis.estadoOperacion.toLowerCase();
                if (estadoOp === 'aprobada') mensajeGabi += `\n✅ Estado: Aprobada`;
                else if (estadoOp === 'pendiente') mensajeGabi += `\n⚠️ Estado: PENDIENTE — no acreditada`;
                else if (estadoOp === 'rechazada') mensajeGabi += `\n❌ Estado: RECHAZADA`;
                else mensajeGabi += `\n⚠️ Estado: ${analisis.estadoOperacion}`;
            }

            // Validar fecha — debe ser de hoy (Argentina)
            if (analisis.fecha) {
                const hoyAR = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
                const fechaComp = analisis.fecha.replace(/-/g, '/').split('/').reverse().join('/');
                const fechaOk = fechaComp === hoyAR || analisis.fecha.replace(/-/g, '/') === hoyAR;
                const estadoFecha = fechaOk ? `✅ ${analisis.fecha}` : `⚠️ ${analisis.fecha} — NO es de hoy`;
                mensajeGabi += `\n📅 ${[estadoFecha, analisis.hora].filter(Boolean).join(' ')}`;
            } else if (analisis.hora) {
                mensajeGabi += `\n📅 ${analisis.hora}`;
            }

            // Validar alias/CVU destinatario contra config de la tienda
            const aliasConfig = config.aliasCobro?.trim().toLowerCase();
            const cvuConfig = config.cvuCobro?.trim();
            if (analisis.alias) {
                const aliasComp = analisis.alias.trim().toLowerCase();
                if (aliasConfig && aliasComp !== aliasConfig) {
                    mensajeGabi += `\n⚠️ Alias: ${analisis.alias} — NO coincide (esperado: ${config.aliasCobro})`;
                } else {
                    mensajeGabi += `\n🔑 Alias: ${analisis.alias}${aliasConfig ? ' ✅' : ''}`;
                }
            }
            if (analisis.cvu) {
                const cvuComp = analisis.cvu.trim();
                if (cvuConfig && cvuComp !== cvuConfig) {
                    mensajeGabi += `\n⚠️ CVU: ${analisis.cvu} — NO coincide`;
                } else {
                    mensajeGabi += `\n🔑 CVU: ${analisis.cvu}${cvuConfig ? ' ✅' : ''}`;
                }
            }

            if (analisis.banco) mensajeGabi += `\n🏦 ${analisis.banco}`;
            if (analisis.tipoTransferencia) mensajeGabi += `\n🔄 ${analisis.tipoTransferencia}`;
            if (analisis.nombreRemitente) mensajeGabi += `\n👤 Remitente: ${analisis.nombreRemitente}`;
            if (analisis.nombreDestinatario) mensajeGabi += `\n🎯 Destinatario: ${analisis.nombreDestinatario}`;
            if (analisis.nroOperacion) mensajeGabi += `\n🧾 Op: ${analisis.nroOperacion}`;
        } else {
            mensajeGabi += `\n_(No se pudo analizar la imagen)_`;
        }

        mensajeGabi += `\n\nEntrá a Reservas para confirmar el pago.`;

        // Siempre mandar texto a Gabi
        this.notificarGabi(mensajeGabi);

        // Además intentar reenviar la imagen (fire-and-forget)
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
                    caption: '📎 Imagen del comprobante',
                    fileName: 'comprobante.jpg',
                }),
            }).catch((err) => this.logger.warn(`sendMedia a Gabi falló: ${err.message}`));
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

        const confirmadas: Array<{ desc: string; precio: number; prendaId: string }> = [];

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
                confirmadas.push({ desc, precio: Number(reserva.prenda.precioVenta), prendaId: reserva.prendaId });
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

        // ── Notificar al grupo de WA por cada prenda vendida ────────
        const evolutionApiUrl = process.env.EVOLUTION_API_URL;
        const evolutionApiKey = process.env.EVOLUTION_API_KEY;
        const evolutionInstance = process.env.EVOLUTION_INSTANCE;
        if (evolutionApiUrl && evolutionApiKey && evolutionInstance) {
            const grupos = await this.prisma.grupoWhatsapp.findMany({ where: { activo: true } });
            if (grupos.length > 0) {
                for (const item of confirmadas) {
                    const prenda = await this.prisma.prenda.findUnique({
                        where: { id: item.prendaId },
                        include: { fotos: { take: 1, orderBy: { orden: 'asc' } } },
                    });
                    const lineas = [`🔴 *VENDIDO*`, item.desc, `💰 $${item.precio.toLocaleString('es-AR')}`];
                    if (prenda?.tieneFalla) lineas.push(`⚠️ Falla: ${prenda.descripcionFalla ?? 'sí'}`);
                    if (prenda?.nota) lineas.push(`📝 ${prenda.nota}`);
                    const mensaje = lineas.join('\n');
                    const fotoUrl = prenda?.fotos?.[0]?.url;

                    if (fotoUrl) {
                        let mediaBase64: string | null = null;
                        try {
                            const imgRes = await fetch(fotoUrl);
                            if (imgRes.ok) {
                                const buffer = await imgRes.arrayBuffer();
                                mediaBase64 = Buffer.from(buffer).toString('base64');
                            }
                        } catch { /* fallback a URL */ }

                        await Promise.allSettled(
                            grupos.map(grupo =>
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
                        await Promise.allSettled(
                            grupos.map(grupo =>
                                fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                                    body: JSON.stringify({ number: grupo.groupId, text: mensaje }),
                                }),
                            ),
                        );
                    }
                }
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
    async findHistorial(skip = 0, take = 50) {
        const where = { estado: { not: 'ACTIVA' as const } };
        const [items, total] = await Promise.all([
            this.prisma.reserva.findMany({
                where,
                include: { prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 }, categoria: true, talle: true } }, cliente: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.reserva.count({ where }),
        ]);
        return { items, total, skip, take };
    }

    // ── Listar reservas activas ──────────────────────────────────
    findActivas() {
        return this.prisma.reserva.findMany({
            where: { estado: 'ACTIVA' },
            include: { prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 }, categoria: true, talle: true } }, cliente: true },
            orderBy: { fechaExpiracion: 'asc' },
        });
    }

    async enviarRecordatorios() {
        const ahora = new Date();
        const candidatas = await this.prisma.reserva.findMany({
            where: { estado: 'ACTIVA', recordatorioEnviado: { not: true } },
            include: { prenda: { include: { fotos: { orderBy: { orden: 'asc' }, take: 1 } } }, cliente: true },
        });

        const paraEnviar = candidatas.filter(r => {
            const restanteMs = r.fechaExpiracion.getTime() - ahora.getTime();
            // Enviar apenas hay más de 1 minuto restante (dispara al minuto de crear la reserva)
            return restanteMs > 60000;
        });

        if (paraEnviar.length === 0) return [];

        await this.prisma.reserva.updateMany({
            where: { id: { in: paraEnviar.map(r => r.id) } },
            data: { recordatorioEnviado: true },
        });

        return paraEnviar.map(r => ({
            telefonoWhatsapp: r.cliente.telefonoWhatsapp,
            minutosRestantes: Math.round((r.fechaExpiracion.getTime() - ahora.getTime()) / 60000),
            fotoUrl: r.prenda.fotos?.[0]?.url ?? null,
        }));
    }
}
