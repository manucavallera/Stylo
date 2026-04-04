import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CajaService } from './caja.service';
import { PrismaService } from '../prisma/prisma.service';

const makePrisma = () => ({
    cajaDiaria: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    venta: {
        aggregate: jest.fn(),
        updateMany: jest.fn(),
    },
    gastoCaja: {
        create: jest.fn(),
        aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
});

describe('CajaService', () => {
    let service: CajaService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(async () => {
        prisma = makePrisma();
        prisma.$transaction.mockImplementation((cb) => cb(prisma));

        const module = await Test.createTestingModule({
            providers: [
                CajaService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<CajaService>(CajaService);
    });

    // ── abrir ────────────────────────────────────────────────────────
    describe('abrir', () => {
        it('lanza ConflictException si ya hay una caja abierta hoy', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue({ id: 'c1', estado: 'ABIERTA' });
            await expect(service.abrir({ montoApertura: 0 })).rejects.toThrow(ConflictException);
        });

        it('crea una nueva caja si no existe ninguna hoy', async () => {
            const mockCaja = { id: 'c1', montoEsperado: 0, estado: 'ABIERTA' };
            prisma.cajaDiaria.findUnique
                .mockResolvedValueOnce(null)   // check inicial
                .mockResolvedValue(mockCaja);  // return al final del tx
            prisma.cajaDiaria.create.mockResolvedValue(mockCaja);
            prisma.venta.aggregate.mockResolvedValue({ _sum: { precioFinal: null } });

            const result = await service.abrir({ montoApertura: 500 });

            expect(prisma.cajaDiaria.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ montoApertura: 500, estado: 'ABIERTA' }),
                }),
            );
            expect(result).toEqual(mockCaja);
        });

        it('asigna ventas huérfanas al crear la caja', async () => {
            const mockCaja = { id: 'c1', montoEsperado: 0 };
            prisma.cajaDiaria.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValue({ ...mockCaja, montoEsperado: 3000 });
            prisma.cajaDiaria.create.mockResolvedValue(mockCaja);
            prisma.venta.aggregate.mockResolvedValue({ _sum: { precioFinal: 3000 } });
            prisma.venta.updateMany.mockResolvedValue({ count: 2 });
            prisma.cajaDiaria.update.mockResolvedValue({});

            await service.abrir({ montoApertura: 0 });

            expect(prisma.venta.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ data: { cajaId: 'c1' } }),
            );
            expect(prisma.cajaDiaria.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { montoEsperado: { increment: 3000 } },
                }),
            );
        });

        it('reactiva una caja cerrada del mismo día', async () => {
            const cajaExistente = { id: 'c1', estado: 'CERRADA', montoEsperado: 5000 };
            const cajaReactivada = { ...cajaExistente, estado: 'ABIERTA', montoReal: null, diferencia: null };
            prisma.cajaDiaria.findUnique
                .mockResolvedValueOnce(cajaExistente)
                .mockResolvedValue(cajaReactivada);
            prisma.cajaDiaria.update.mockResolvedValue({});
            prisma.venta.aggregate.mockResolvedValue({ _sum: { precioFinal: null } });

            const result = await service.abrir({ montoApertura: 0 });

            expect(prisma.cajaDiaria.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'c1' },
                    data: expect.objectContaining({ estado: 'ABIERTA', montoReal: null, diferencia: null }),
                }),
            );
            expect(result).toEqual(cajaReactivada);
        });

        it('asigna ventas huérfanas al reabrir una caja cerrada', async () => {
            const cajaExistente = { id: 'c1', estado: 'CERRADA' };
            prisma.cajaDiaria.findUnique
                .mockResolvedValueOnce(cajaExistente)
                .mockResolvedValue({ id: 'c1', montoEsperado: 2000 });
            prisma.cajaDiaria.update.mockResolvedValue({});
            prisma.venta.aggregate.mockResolvedValue({ _sum: { precioFinal: 2000 } });
            prisma.venta.updateMany.mockResolvedValue({ count: 1 });

            await service.abrir({ montoApertura: 0 });

            expect(prisma.venta.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({ data: { cajaId: 'c1' } }),
            );
        });
    });

    // ── cerrar ───────────────────────────────────────────────────────
    describe('cerrar', () => {
        it('lanza NotFoundException si la caja no existe', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue(null);
            await expect(service.cerrar('c1', { montoReal: 0 })).rejects.toThrow(NotFoundException);
        });

        it('lanza BadRequestException si la caja ya está cerrada', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue({ id: 'c1', estado: 'CERRADA' });
            await expect(service.cerrar('c1', { montoReal: 0 })).rejects.toThrow(BadRequestException);
        });

        it('calcula montoEsperado = apertura + ventas - gastos y diferencia correctamente', async () => {
            // apertura: $1.000 + ventas: $3.000 - gastos: $500 = montoEsperado $3.500
            // montoReal: $3.200 → diferencia: -$300
            prisma.cajaDiaria.findUnique.mockResolvedValue({
                id: 'c1',
                estado: 'ABIERTA',
                montoApertura: 1000,
            });
            prisma.venta.aggregate.mockResolvedValue({ _sum: { precioFinal: 3000 } });
            prisma.gastoCaja.aggregate.mockResolvedValue({ _sum: { monto: 500 } });
            prisma.cajaDiaria.update.mockResolvedValue({});

            await service.cerrar('c1', { montoReal: 3200 });

            expect(prisma.cajaDiaria.update).toHaveBeenCalledWith({
                where: { id: 'c1' },
                data: {
                    montoReal: 3200,
                    montoEsperado: 3500,
                    diferencia: -300,
                    estado: 'CERRADA',
                },
            });
        });

        it('calcula correctamente sin gastos del día', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue({
                id: 'c1',
                estado: 'ABIERTA',
                montoApertura: 0,
            });
            prisma.venta.aggregate.mockResolvedValue({ _sum: { precioFinal: 5000 } });
            prisma.gastoCaja.aggregate.mockResolvedValue({ _sum: { monto: null } });
            prisma.cajaDiaria.update.mockResolvedValue({});

            await service.cerrar('c1', { montoReal: 5000 });

            expect(prisma.cajaDiaria.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ montoEsperado: 5000, diferencia: 0 }),
                }),
            );
        });
    });

    // ── registrarGasto ───────────────────────────────────────────────
    describe('registrarGasto', () => {
        it('lanza BadRequestException si la caja está cerrada', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue({ id: 'c1', estado: 'CERRADA' });
            await expect(
                service.registrarGasto('c1', { concepto: 'Bolsas', monto: 100 }),
            ).rejects.toThrow(BadRequestException);
        });

        it('lanza NotFoundException si la caja no existe', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue(null);
            await expect(
                service.registrarGasto('c1', { concepto: 'Bolsas', monto: 100 }),
            ).rejects.toThrow(NotFoundException);
        });

        it('registra el gasto correctamente', async () => {
            prisma.cajaDiaria.findUnique.mockResolvedValue({ id: 'c1', estado: 'ABIERTA' });
            prisma.gastoCaja.create.mockResolvedValue({ id: 'g1', concepto: 'Bolsas', monto: 100 });

            const result = await service.registrarGasto('c1', { concepto: 'Bolsas', monto: 100 });

            expect(prisma.gastoCaja.create).toHaveBeenCalledWith({
                data: { cajaId: 'c1', concepto: 'Bolsas', monto: 100 },
            });
            expect(result).toMatchObject({ concepto: 'Bolsas', monto: 100 });
        });
    });
});
