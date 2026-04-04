import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';

global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });

const makePrisma = () => ({
    prenda: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    reserva: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    cajaDiaria: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    venta: { create: jest.fn() },
    cliente: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    $transaction: jest.fn(),
});

describe('ReservasService', () => {
    let service: ReservasService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(async () => {
        prisma = makePrisma();
        prisma.$transaction.mockImplementation((cb) => cb(prisma));

        const module = await Test.createTestingModule({
            providers: [
                ReservasService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: ConfiguracionService,
                    useValue: { getConfig: jest.fn().mockResolvedValue({ minutosReserva: 20 }) },
                },
            ],
        }).compile();

        service = module.get<ReservasService>(ReservasService);
    });

    // ── create ──────────────────────────────────────────────────────
    describe('create', () => {
        it('lanza NotFoundException si la prenda no existe', async () => {
            prisma.prenda.findUnique.mockResolvedValue(null);
            await expect(service.create({ prendaId: 'p1', clienteId: 'c1' })).rejects.toThrow(NotFoundException);
        });

        it('lanza BadRequestException si la prenda ya no está disponible (race condition)', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'RESERVADO' });
            prisma.prenda.updateMany.mockResolvedValue({ count: 0 });
            await expect(service.create({ prendaId: 'p1', clienteId: 'c1' })).rejects.toThrow(BadRequestException);
        });

        it('crea la reserva y marca la prenda como RESERVADO', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'DISPONIBLE' });
            prisma.prenda.updateMany.mockResolvedValue({ count: 1 });
            const mockReserva = {
                id: 'r1',
                fechaExpiracion: new Date(),
                prenda: { fotos: [], categoria: null, talle: null },
                cliente: { telefonoWhatsapp: '5491100000000' },
            };
            prisma.reserva.create.mockResolvedValue(mockReserva);

            const result = await service.create({ prendaId: 'p1', clienteId: 'c1' });

            expect(prisma.prenda.updateMany).toHaveBeenCalledWith({
                where: { id: 'p1', estado: 'DISPONIBLE' },
                data: { estado: 'RESERVADO' },
            });
            expect(prisma.reserva.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ estado: 'ACTIVA' }) }),
            );
            expect(result).toEqual(mockReserva);
        });

        it('respeta los minutosExpiracion del DTO', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', estado: 'DISPONIBLE' });
            prisma.prenda.updateMany.mockResolvedValue({ count: 1 });
            prisma.reserva.create.mockResolvedValue({
                id: 'r1',
                fechaExpiracion: new Date(),
                prenda: { fotos: [] },
                cliente: { telefonoWhatsapp: null },
            });

            const antes = Date.now();
            await service.create({ prendaId: 'p1', clienteId: 'c1', minutosExpiracion: 30 });

            const llamada = prisma.reserva.create.mock.calls[0][0];
            const expiracion = llamada.data.fechaExpiracion as Date;
            const diffMin = (expiracion.getTime() - antes) / 60000;
            expect(diffMin).toBeGreaterThanOrEqual(29.9);
            expect(diffMin).toBeLessThanOrEqual(30.1);
        });
    });

    // ── confirmar ────────────────────────────────────────────────────
    describe('confirmar', () => {
        it('lanza NotFoundException si la reserva no existe', async () => {
            prisma.reserva.findUnique.mockResolvedValue(null);
            await expect(service.confirmar('r1', {})).rejects.toThrow(NotFoundException);
        });

        it('lanza BadRequestException si la reserva no está ACTIVA', async () => {
            prisma.reserva.findUnique.mockResolvedValue({
                id: 'r1',
                estado: 'EXPIRADA',
                prenda: { precioVenta: 10000, costoUnitario: 3000 },
            });
            await expect(service.confirmar('r1', {})).rejects.toThrow(BadRequestException);
        });

        it('marca prenda VENDIDO, crea venta y suma a la caja', async () => {
            prisma.reserva.findUnique.mockResolvedValue({
                id: 'r1',
                estado: 'ACTIVA',
                prendaId: 'p1',
                clienteId: 'c1',
                prenda: { precioVenta: 15000, costoUnitario: 5000 },
            });
            prisma.cajaDiaria.findFirst.mockResolvedValue({ id: 'caja1' });
            prisma.reserva.update.mockResolvedValue({ prenda: { fotos: [] }, cliente: { telefonoWhatsapp: null } });
            prisma.prenda.update.mockResolvedValue({});
            prisma.venta.create.mockResolvedValue({});
            prisma.cajaDiaria.update.mockResolvedValue({});

            await service.confirmar('r1', {});

            expect(prisma.prenda.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { estado: 'VENDIDO' },
            });
            expect(prisma.venta.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        metodoPago: 'TRANSFERENCIA',
                        canalVenta: 'ONLINE',
                        precioFinal: 15000,
                        cajaId: 'caja1',
                    }),
                }),
            );
            expect(prisma.cajaDiaria.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { montoEsperado: { increment: 15000 } },
                }),
            );
        });

        it('crea la venta sin cajaId si no hay caja abierta', async () => {
            prisma.reserva.findUnique.mockResolvedValue({
                id: 'r1',
                estado: 'ACTIVA',
                prendaId: 'p1',
                clienteId: null,
                prenda: { precioVenta: 10000, costoUnitario: 3000 },
            });
            prisma.cajaDiaria.findFirst.mockResolvedValue(null);
            prisma.reserva.update.mockResolvedValue({ prenda: { fotos: [] }, cliente: null });
            prisma.prenda.update.mockResolvedValue({});
            prisma.venta.create.mockResolvedValue({});

            await service.confirmar('r1', {});

            expect(prisma.venta.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ cajaId: null }),
                }),
            );
            expect(prisma.cajaDiaria.update).not.toHaveBeenCalled();
        });
    });

    // ── cancelar ─────────────────────────────────────────────────────
    describe('cancelar', () => {
        it('lanza NotFoundException si la reserva no existe', async () => {
            prisma.reserva.findUnique.mockResolvedValue(null);
            await expect(service.cancelar('r1')).rejects.toThrow(NotFoundException);
        });

        it('lanza BadRequestException si la reserva no está ACTIVA', async () => {
            prisma.reserva.findUnique.mockResolvedValue({ id: 'r1', estado: 'CONFIRMADA', prendaId: 'p1' });
            await expect(service.cancelar('r1')).rejects.toThrow(BadRequestException);
        });

        it('cancela la reserva y devuelve la prenda a DISPONIBLE', async () => {
            prisma.reserva.findUnique.mockResolvedValue({ id: 'r1', estado: 'ACTIVA', prendaId: 'p1' });
            prisma.reserva.update.mockResolvedValue({});
            prisma.prenda.update.mockResolvedValue({});

            await service.cancelar('r1');

            expect(prisma.reserva.update).toHaveBeenCalledWith({
                where: { id: 'r1' },
                data: { estado: 'CANCELADA' },
            });
            expect(prisma.prenda.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { estado: 'DISPONIBLE' },
            });
        });
    });

    // ── expirarVencidas ──────────────────────────────────────────────
    describe('expirarVencidas', () => {
        it('devuelve { expiradas: 0 } si no hay reservas vencidas', async () => {
            prisma.reserva.findMany.mockResolvedValue([]);
            const result = await service.expirarVencidas();
            expect(result).toEqual({ expiradas: 0 });
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('expira reservas y libera las prendas correspondientes', async () => {
            prisma.reserva.findMany.mockResolvedValue([
                { id: 'r1', prendaId: 'p1' },
                { id: 'r2', prendaId: 'p2' },
            ]);
            prisma.reserva.update.mockResolvedValue({});
            prisma.prenda.update.mockResolvedValue({});

            const result = await service.expirarVencidas();

            expect(result).toEqual({ expiradas: 2 });
            expect(prisma.reserva.update).toHaveBeenCalledTimes(2);
            expect(prisma.prenda.update).toHaveBeenCalledTimes(2);
            expect(prisma.prenda.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { estado: 'DISPONIBLE' },
            });
            expect(prisma.prenda.update).toHaveBeenCalledWith({
                where: { id: 'p2' },
                data: { estado: 'DISPONIBLE' },
            });
        });
    });

    // ── reservarDesdeBot ─────────────────────────────────────────────
    describe('reservarDesdeBot', () => {
        it('lanza NotFoundException si la prenda no existe', async () => {
            prisma.cliente.findFirst.mockResolvedValue({ id: 'c1', telefonoWhatsapp: '54911' });
            prisma.prenda.findFirst.mockResolvedValue(null);
            await expect(
                service.reservarDesdeBot({ prendaId: 'abcd1234', telefonoWhatsapp: '54911' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('crea un cliente nuevo si no existe y hace la reserva', async () => {
            const nuevoCliente = { id: 'c-new', telefonoWhatsapp: '5491199999999' };
            const mockPrenda = { id: 'prenda-full-uuid', estado: 'DISPONIBLE' };
            const mockReserva = {
                id: 'r1',
                fechaExpiracion: new Date(),
                prenda: { fotos: [], categoria: null, talle: null },
                cliente: nuevoCliente,
            };
            prisma.cliente.findFirst.mockResolvedValue(null);
            prisma.cliente.create.mockResolvedValue(nuevoCliente);
            prisma.prenda.findFirst.mockResolvedValue(mockPrenda);
            prisma.prenda.findUnique.mockResolvedValue(mockPrenda);
            prisma.prenda.updateMany.mockResolvedValue({ count: 1 });
            prisma.reserva.create.mockResolvedValue(mockReserva);

            await service.reservarDesdeBot({ prendaId: 'prenda-fu', telefonoWhatsapp: '5491199999999' });

            expect(prisma.cliente.create).toHaveBeenCalled();
        });

        it('reutiliza el cliente existente sin crear uno nuevo', async () => {
            const clienteExistente = { id: 'c-existing', telefonoWhatsapp: '5491100000000' };
            const mockPrenda = { id: 'prenda-full-uuid', estado: 'DISPONIBLE' };
            const mockReserva = {
                id: 'r1',
                fechaExpiracion: new Date(),
                prenda: { fotos: [], categoria: null, talle: null },
                cliente: clienteExistente,
            };
            prisma.cliente.findFirst.mockResolvedValue(clienteExistente);
            prisma.prenda.findFirst.mockResolvedValue(mockPrenda);
            prisma.prenda.findUnique.mockResolvedValue(mockPrenda);
            prisma.prenda.updateMany.mockResolvedValue({ count: 1 });
            prisma.reserva.create.mockResolvedValue(mockReserva);

            await service.reservarDesdeBot({ prendaId: 'prenda-fu', telefonoWhatsapp: '5491100000000' });

            expect(prisma.cliente.create).not.toHaveBeenCalled();
        });
    });
});
