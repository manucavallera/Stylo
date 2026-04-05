import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AbrirCajaDto, CerrarCajaDto, RegistrarGastoDto } from './dto/caja.dto';

@Injectable()
export class CajaService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Abrir caja del día ───────────────────────────────────────
    async abrir(dto: AbrirCajaDto) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const cajaExistente = await this.prisma.cajaDiaria.findUnique({
            where: { fecha: hoy },
        });

        // Si ya existe una caja cerrada hoy, la reactiva en vez de crear una nueva
        if (cajaExistente) {
            if (cajaExistente.estado === 'ABIERTA') {
                throw new ConflictException('Ya hay una caja abierta para hoy');
            }
            return this.prisma.$transaction(async (tx) => {
                await tx.cajaDiaria.update({
                    where: { id: cajaExistente.id },
                    data: { estado: 'ABIERTA', montoReal: null, diferencia: null },
                });

                // Asignar ventas huérfanas de hoy (solo efectivo suma al esperado)
                const huerfanas = await tx.venta.aggregate({
                    where: { cajaId: null, fechaVenta: { gte: hoy }, metodoPago: 'EFECTIVO' },
                    _sum: { precioFinal: true },
                });
                const sumaHuerfanas = Number(huerfanas._sum.precioFinal ?? 0);

                await tx.venta.updateMany({
                    where: { cajaId: null, fechaVenta: { gte: hoy } },
                    data: { cajaId: cajaExistente.id },
                });
                if (sumaHuerfanas > 0) {
                    await tx.cajaDiaria.update({
                        where: { id: cajaExistente.id },
                        data: { montoEsperado: { increment: sumaHuerfanas } },
                    });
                }

                return tx.cajaDiaria.findUnique({ where: { id: cajaExistente.id } });
            });
        }

        return this.prisma.$transaction(async (tx) => {
            const caja = await tx.cajaDiaria.create({
                data: {
                    fecha: hoy,
                    montoApertura: dto.montoApertura,
                    montoEsperado: dto.montoApertura, // arranca con el efectivo inicial
                    estado: 'ABIERTA',
                },
            });

            // Asignar ventas huérfanas de hoy (solo efectivo suma al esperado)
            const huerfanas = await tx.venta.aggregate({
                where: { cajaId: null, fechaVenta: { gte: hoy }, metodoPago: 'EFECTIVO' },
                _sum: { precioFinal: true },
            });
            const sumaHuerfanas = Number(huerfanas._sum.precioFinal ?? 0);

            await tx.venta.updateMany({
                where: { cajaId: null, fechaVenta: { gte: hoy } },
                data: { cajaId: caja.id },
            });
            if (sumaHuerfanas > 0) {
                await tx.cajaDiaria.update({
                    where: { id: caja.id },
                    data: { montoEsperado: { increment: sumaHuerfanas } },
                });
            }

            return tx.cajaDiaria.findUnique({ where: { id: caja.id } });
        });
    }

    // ── Estado actual de la caja de hoy ─────────────────────────
    async cajaHoy() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const caja = await this.prisma.cajaDiaria.findUnique({
            where: { fecha: hoy },
            include: {
                ventas: {
                    select: {
                        id: true,
                        precioFinal: true,
                        metodoPago: true,
                        fechaVenta: true,
                        prenda: { select: { id: true } },
                    },
                    orderBy: { fechaVenta: 'desc' },
                },
                gastos: { orderBy: { createdAt: 'desc' } },
            },
        });

        if (!caja) throw new NotFoundException('No hay caja abierta para hoy');
        return caja;
    }

    // ── Cerrar caja: Gabi cuenta la plata y el sistema compara ───
    async cerrar(id: string, dto: CerrarCajaDto) {
        const caja = await this.prisma.cajaDiaria.findUnique({ where: { id } });
        if (!caja) throw new NotFoundException('Caja no encontrada');
        if (caja.estado === 'CERRADA') {
            throw new BadRequestException('Esta caja ya está cerrada');
        }

        // montoEsperado = apertura + ventas EFECTIVO - gastos y retiros
        const [ventasEfectivo, salidaCaja] = await Promise.all([
            this.prisma.venta.aggregate({
                where: { cajaId: id, metodoPago: 'EFECTIVO' },
                _sum: { precioFinal: true },
            }),
            this.prisma.gastoCaja.aggregate({
                where: { cajaId: id },
                _sum: { monto: true },
            }),
        ]);

        const montoEsperado =
            Number(caja.montoApertura) +
            Number(ventasEfectivo._sum.precioFinal ?? 0) -
            Number(salidaCaja._sum.monto ?? 0);

        const diferencia = dto.montoReal - montoEsperado;

        return this.prisma.cajaDiaria.update({
            where: { id },
            data: {
                montoReal: dto.montoReal,
                montoEsperado,
                diferencia,
                estado: 'CERRADA',
            },
        });
    }

    // ── Gastos de caja ───────────────────────────────────────────
    async registrarGasto(cajaId: string, dto: RegistrarGastoDto) {
        const caja = await this.prisma.cajaDiaria.findUnique({ where: { id: cajaId } });
        if (!caja) throw new NotFoundException('Caja no encontrada');
        if (caja.estado === 'CERRADA') throw new BadRequestException('No se puede registrar gastos en una caja cerrada');

        return this.prisma.gastoCaja.create({
            data: { cajaId, concepto: dto.concepto, monto: dto.monto, tipo: dto.tipo ?? 'GASTO' },
        });
    }

    async obtenerGastos(cajaId: string) {
        return this.prisma.gastoCaja.findMany({
            where: { cajaId },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ── Historial de cajas ───────────────────────────────────────
    findAll() {
        return this.prisma.cajaDiaria.findMany({
            orderBy: { fecha: 'desc' },
            take: 30,
        });
    }
}
