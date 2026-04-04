import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetodoPago, CanalVenta } from './dto/create-venta.dto';

const makePrisma = () => ({
    prenda: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    venta: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
    },
    cajaDiaria: {
        update: jest.fn(),
    },
    reserva: {
        update: jest.fn(),
        count: jest.fn(),
    },
    $transaction: jest.fn(),
});

describe('VentasService', () => {
    let service: VentasService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(async () => {
        prisma = makePrisma();
        prisma.$transaction.mockImplementation((cb) => cb(prisma));

        const module = await Test.createTestingModule({
            providers: [
                VentasService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<VentasService>(VentasService);
    });

    // ── create ───────────────────────────────────────────────────────
    describe('create', () => {
        const dtoBase = { prendaId: 'p1', precioFinal: 15000, metodoPago: MetodoPago.EFECTIVO, canalVenta: CanalVenta.LOCAL };

        it('lanza NotFoundException si la prenda no existe', async () => {
            prisma.prenda.findUnique.mockResolvedValue(null);
            await expect(service.create(dtoBase)).rejects.toThrow(NotFoundException);
        });

        it('lanza BadRequestException si la prenda ya fue vendida', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'VENDIDO', costoUnitario: 3000 });
            await expect(service.create(dtoBase)).rejects.toThrow(BadRequestException);
        });

        it('lanza BadRequestException si la prenda está RETIRADO', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'RETIRADO', costoUnitario: 3000 });
            await expect(service.create(dtoBase)).rejects.toThrow(BadRequestException);
        });

        it('crea la venta, marca prenda VENDIDO y suma a la caja', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'DISPONIBLE', costoUnitario: 3000 });
            const mockVenta = { id: 'v1', precioFinal: 15000, prenda: {}, cliente: null, reserva: null };
            prisma.venta.create.mockResolvedValue(mockVenta);
            prisma.prenda.update.mockResolvedValue({});
            prisma.cajaDiaria.update.mockResolvedValue({});

            const result = await service.create({ ...dtoBase, cajaId: 'caja1' });

            expect(prisma.venta.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        prendaId: 'p1',
                        precioFinal: 15000,
                        costoHistoricoArs: 3000,
                        metodoPago: 'EFECTIVO',
                        canalVenta: 'LOCAL',
                    }),
                }),
            );
            expect(prisma.prenda.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { estado: 'VENDIDO' },
            });
            expect(prisma.cajaDiaria.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'caja1' },
                    data: { montoEsperado: { increment: 15000 } },
                }),
            );
            expect(result).toEqual(mockVenta);
        });

        it('crea la venta sin cajaId si no se especifica', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'DISPONIBLE', costoUnitario: 3000 });
            prisma.venta.create.mockResolvedValue({ id: 'v1', prenda: {}, cliente: null, reserva: null });
            prisma.prenda.update.mockResolvedValue({});

            await service.create(dtoBase); // sin cajaId

            expect(prisma.cajaDiaria.update).not.toHaveBeenCalled();
        });

        it('marca la reserva como CONFIRMADA si la venta viene de una reserva', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'RESERVADO', costoUnitario: 3000 });
            prisma.venta.create.mockResolvedValue({ id: 'v1', prenda: {}, cliente: null, reserva: null });
            prisma.prenda.update.mockResolvedValue({});
            prisma.reserva.update.mockResolvedValue({});

            await service.create({
                prendaId: 'p1',
                reservaId: 'r1',
                precioFinal: 15000,
                metodoPago: MetodoPago.TRANSFERENCIA,
                canalVenta: CanalVenta.ONLINE,
            });

            expect(prisma.reserva.update).toHaveBeenCalledWith({
                where: { id: 'r1' },
                data: { estado: 'CONFIRMADA' },
            });
        });

        it('no actualiza reserva si la venta es directa (sin reservaId)', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'DISPONIBLE', costoUnitario: 3000 });
            prisma.venta.create.mockResolvedValue({ id: 'v1', prenda: {}, cliente: null, reserva: null });
            prisma.prenda.update.mockResolvedValue({});

            await service.create(dtoBase); // sin reservaId

            expect(prisma.reserva.update).not.toHaveBeenCalled();
        });

        it('congela el costoHistoricoArs de la prenda al momento de la venta', async () => {
            // Si el costoUnitario cambia después, el histórico debe preservar el valor original
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'DISPONIBLE', costoUnitario: 7500 });
            prisma.venta.create.mockResolvedValue({ id: 'v1', prenda: {}, cliente: null, reserva: null });
            prisma.prenda.update.mockResolvedValue({});

            await service.create(dtoBase);

            const llamada = prisma.venta.create.mock.calls[0][0];
            expect(llamada.data.costoHistoricoArs).toBe(7500);
        });
    });
});
