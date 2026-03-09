import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTalleDto } from './dto/create-talle.dto';
import { UpdateTalleDto } from './dto/update-talle.dto';

@Injectable()
export class TallesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateTalleDto) {
        const existe = await this.prisma.talle.findUnique({ where: { nombre: dto.nombre } });
        if (existe) throw new ConflictException(`El talle "${dto.nombre}" ya existe`);
        return this.prisma.talle.create({ data: dto });
    }

    findAll() {
        return this.prisma.talle.findMany({ orderBy: { nombre: 'asc' } });
    }

    async findOne(id: string) {
        const talle = await this.prisma.talle.findUnique({ where: { id } });
        if (!talle) throw new NotFoundException(`Talle ${id} no encontrado`);
        return talle;
    }

    async update(id: string, dto: UpdateTalleDto) {
        await this.findOne(id);
        return this.prisma.talle.update({ where: { id }, data: dto });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.talle.delete({ where: { id } });
    }
}
