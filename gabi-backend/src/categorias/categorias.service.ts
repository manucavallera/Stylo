import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateCategoriaDto) {
        const existe = await this.prisma.categoria.findUnique({ where: { nombre: dto.nombre } });
        if (existe) throw new ConflictException(`La categoría "${dto.nombre}" ya existe`);
        return this.prisma.categoria.create({ data: dto });
    }

    findAll() {
        return this.prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
    }

    async findOne(id: string) {
        const categoria = await this.prisma.categoria.findUnique({ where: { id } });
        if (!categoria) throw new NotFoundException(`Categoría ${id} no encontrada`);
        return categoria;
    }

    async update(id: string, dto: UpdateCategoriaDto) {
        await this.findOne(id);
        return this.prisma.categoria.update({ where: { id }, data: dto });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.categoria.delete({ where: { id } });
    }
}
