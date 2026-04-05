import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
    constructor(private readonly prisma: PrismaService) { }

    create(dto: CreateClienteDto) {
        return this.prisma.cliente.create({ data: dto });
    }

    findAll() {
        return this.prisma.cliente.findMany({
            orderBy: { nombre: 'asc' },
            include: {
                _count: { select: { ventas: true } },
                ventas: { select: { precioFinal: true, fechaVenta: true }, orderBy: { fechaVenta: 'desc' }, take: 1 },
            },
        });
    }

    async findOne(id: string) {
        const cliente = await this.prisma.cliente.findUnique({
            where: { id },
            include: {
                ventas: {
                    orderBy: { fechaVenta: 'desc' },
                    include: {
                        prenda: {
                            include: {
                                categoria: true,
                                talle: true,
                                fotos: { orderBy: { orden: 'asc' }, take: 1 },
                            },
                        },
                    },
                },
                reservas: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        prenda: { include: { categoria: true, talle: true } },
                    },
                },
            },
        });
        if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
        return cliente;
    }

    async update(id: string, dto: UpdateClienteDto) {
        await this.findOne(id);
        return this.prisma.cliente.update({ where: { id }, data: dto });
    }

    async remove(id: string) {
        const [ventasCount, reservasCount] = await Promise.all([
            this.prisma.venta.count({ where: { clienteId: id } }),
            this.prisma.reserva.count({ where: { clienteId: id } }),
        ]);
        if (ventasCount > 0) {
            throw new BadRequestException('No se puede eliminar un cliente que tiene ventas registradas');
        }
        if (reservasCount > 0) {
            throw new BadRequestException('No se puede eliminar un cliente que tiene reservas registradas');
        }
        return this.prisma.cliente.delete({ where: { id } });
    }
}
