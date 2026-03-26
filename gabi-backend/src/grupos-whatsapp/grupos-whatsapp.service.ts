import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GruposWhatsappService {
    constructor(private readonly prisma: PrismaService) { }

    findAll() {
        return this.prisma.grupoWhatsapp.findMany({ orderBy: { createdAt: 'asc' } });
    }

    findActivos() {
        return this.prisma.grupoWhatsapp.findMany({ where: { activo: true }, orderBy: { createdAt: 'asc' } });
    }

    crear(data: { nombre: string; groupId: string }) {
        return this.prisma.grupoWhatsapp.create({ data });
    }

    async actualizar(id: string, data: { nombre?: string; groupId?: string; activo?: boolean }) {
        const grupo = await this.prisma.grupoWhatsapp.findUnique({ where: { id } });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        return this.prisma.grupoWhatsapp.update({ where: { id }, data });
    }

    async eliminar(id: string) {
        const grupo = await this.prisma.grupoWhatsapp.findUnique({ where: { id } });
        if (!grupo) throw new NotFoundException('Grupo no encontrado');
        await this.prisma.grupoWhatsapp.delete({ where: { id } });
    }
}
