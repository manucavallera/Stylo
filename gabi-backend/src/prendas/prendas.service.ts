import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GruposWhatsappService } from '../grupos-whatsapp/grupos-whatsapp.service';
import { UpdatePrendaDto } from './dto/update-prenda.dto';

@Injectable()
export class PrendasService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly gruposService: GruposWhatsappService,
    ) { }

    // ── Stats rápidas para el dashboard ─────────────────────────
    async stats() {
        const [disponibles, reservadas, sinFoto] = await Promise.all([
            this.prisma.prenda.count({ where: { estado: 'DISPONIBLE' } }),
            this.prisma.prenda.count({ where: { estado: 'RESERVADO' } }),
            this.prisma.prenda.count({ where: { estado: 'DISPONIBLE', fotos: { none: {} } } }),
        ]);
        return { disponibles, reservadas, sinFoto };
    }

    // ── Listar prendas con filtros, búsqueda y paginación ────────
    findAll(filters?: {
        estado?: string;
        categoriaId?: string;
        talleId?: string;
        fardoId?: string;
        search?: string;
        sinFoto?: boolean;
        skip?: number;
        take?: number;
    }) {
        const searchConditions = filters?.search ? {
            OR: [
                { categoria: { nombre: { contains: filters.search, mode: 'insensitive' as const } } },
                { talle: { nombre: { contains: filters.search, mode: 'insensitive' as const } } },
                { nota: { contains: filters.search, mode: 'insensitive' as const } },
            ],
        } : undefined;

        return this.prisma.prenda.findMany({
            where: {
                ...(filters?.estado && { estado: filters.estado as any }),
                ...(filters?.categoriaId && { categoriaId: filters.categoriaId }),
                ...(filters?.talleId && { talleId: filters.talleId }),
                ...(filters?.fardoId && { fardoId: filters.fardoId }),
                ...(filters?.sinFoto && { fotos: { none: {} } }),
                ...searchConditions,
            },
            include: {
                categoria: true,
                talle: true,
                fotos: { orderBy: { orden: 'asc' } },
                fardo: { select: { id: true, nombre: true, fechaCompra: true, moneda: true, proveedor: { select: { nombre: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            ...(filters?.skip !== undefined && { skip: filters.skip }),
            ...(filters?.take !== undefined && { take: filters.take }),
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
            include: { categoria: true, talle: true, fotos: true, fardo: { select: { id: true, nombre: true, proveedor: { select: { nombre: true } } } } },
        });
        if (!prenda) throw new NotFoundException('QR no reconocido');
        return prenda;
    }

    // ── Actualizar precio y/o estado ────────────────────────────
    async update(id: string, dto: UpdatePrendaDto) {
        await this.findOne(id);
        return this.prisma.prenda.update({
            where: { id },
            data: dto as any,
            include: { categoria: true, talle: true, fotos: true, fardo: { include: { proveedor: true } } },
        });
    }

    // ── Eliminar prenda ─────────────────────────────────────────
    async remove(id: string) {
        const prenda = await this.findOne(id);
        if (prenda.venta) {
            throw new BadRequestException('No se puede eliminar una prenda que ya fue vendida');
        }
        await this.prisma.$transaction([
            this.prisma.carritoBot.deleteMany({ where: { prendaId: id } }),
            this.prisma.reserva.deleteMany({ where: { prendaId: id } }),
            this.prisma.prenda.delete({ where: { id } }),
            this.prisma.fardo.update({
                where: { id: prenda.fardoId },
                data: { totalPrendas: { decrement: 1 } },
            }),
        ]);
    }

    // ── Fotos ────────────────────────────────────────────────────
    async addFoto(prendaId: string, url: string, orden: number) {
        await this.findOne(prendaId);
        return this.prisma.fotoPrenda.create({ data: { prendaId, url, orden } });
    }

    async removeFoto(prendaId: string, fotoId: string) {
        await this.prisma.fotoPrenda.deleteMany({ where: { id: fotoId, prendaId } });
    }

    // ── Publicar prenda individual al grupo de WhatsApp ──────────
    async publicarAlGrupo(id: string) {
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

        const prenda = await this.prisma.prenda.findUnique({
            where: { id },
            include: { categoria: true, talle: true, fotos: { orderBy: { orden: 'asc' }, take: 1 } },
        });
        if (!prenda) throw new NotFoundException(`Prenda ${id} no encontrada`);
        if (!prenda.fotos.length) throw new BadRequestException('La prenda no tiene foto');

        const categoria = prenda.categoria?.nombre || '';
        const talle = prenda.talle?.nombre || '';
        const precio = Number(prenda.precioVenta).toLocaleString('es-AR');
        const codigo = prenda.id.substring(0, 8);
        const desc = [categoria, talle].filter(Boolean).join(' — Talle ');
        const codigoInvisible = codigo.split('').map(c => ({ '0':'\u200B\u200B\u200B\u200B','1':'\u200B\u200B\u200B\u200C','2':'\u200B\u200B\u200C\u200B','3':'\u200B\u200B\u200C\u200C','4':'\u200B\u200C\u200B\u200B','5':'\u200B\u200C\u200B\u200C','6':'\u200B\u200C\u200C\u200B','7':'\u200B\u200C\u200C\u200C','8':'\u200C\u200B\u200B\u200B','9':'\u200C\u200B\u200B\u200C','a':'\u200C\u200B\u200C\u200B','b':'\u200C\u200B\u200C\u200C','c':'\u200C\u200C\u200B\u200B','d':'\u200C\u200C\u200B\u200C','e':'\u200C\u200C\u200C\u200B','f':'\u200C\u200C\u200C\u200C' }[c] || '')).join('');
        const notaLinea = (prenda as any).nota ? `📝 ${(prenda as any).nota}\n` : '';
        const caption =
            `${desc || 'Prenda'}\n` +
            `${notaLinea}` +
            `💰 $${precio}\n` +
            `📲 Reenviá esta foto al número de la tienda para reservar${codigoInvisible}`;

        // Descargar imagen en el backend para evitar que Evolution API resuelva DNS de Supabase
        let mediaBase64: string | null = null;
        try {
            const imgRes = await fetch(prenda.fotos[0].url);
            if (imgRes.ok) {
                const buffer = await imgRes.arrayBuffer();
                mediaBase64 = Buffer.from(buffer).toString('base64');
            }
        } catch { /* fallback a URL si falla */ }

        for (const grupo of grupos) {
            const res = await fetch(`${evolutionApiUrl}/message/sendMedia/${evolutionInstance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
                body: JSON.stringify({ number: grupo.groupId, mediatype: 'image', mimetype: 'image/jpeg', media: mediaBase64 ?? prenda.fotos[0].url, caption, fileName: 'prenda.jpg' }),
            });
            if (!res.ok) throw new BadRequestException(`Error al enviar a ${grupo.nombre}: ${await res.text()}`);
        }

        return { ok: true };
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
