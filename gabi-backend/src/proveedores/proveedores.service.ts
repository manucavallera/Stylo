import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';

@Injectable()
export class ProveedoresService {
    constructor(private readonly prisma: PrismaService) { }

    create(dto: CreateProveedorDto) {
        return this.prisma.proveedor.create({ data: dto });
    }

    findAll() {
        return this.prisma.proveedor.findMany({
            orderBy: { nombre: 'asc' },
        });
    }

    async findOne(id: string) {
        const proveedor = await this.prisma.proveedor.findUnique({
            where: { id },
            include: { fardos: { orderBy: { fechaCompra: 'desc' } } },
        });
        if (!proveedor) throw new NotFoundException(`Proveedor ${id} no encontrado`);
        return proveedor;
    }

    async update(id: string, dto: UpdateProveedorDto) {
        await this.findOne(id);
        return this.prisma.proveedor.update({ where: { id }, data: dto });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.proveedor.delete({ where: { id } });
    }
}
