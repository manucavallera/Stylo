import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FardosService } from './fardos.service';
import { PrismaService } from '../prisma/prisma.service';
import { GruposWhatsappService } from '../grupos-whatsapp/grupos-whatsapp.service';

jest.mock('qrcode', () => ({
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mockqr'),
}));

global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => '',
    arrayBuffer: async () => new ArrayBuffer(0),
});

const makePrisma = () => ({
    fardo: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    prenda: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    venta: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn(),
});

const mockGruposService = {
    findActivos: jest.fn().mockResolvedValue([]),
};

describe('FardosService', () => {
    let service: FardosService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(async () => {
        prisma = makePrisma();
        prisma.$transaction.mockImplementation((cbOrArray) => {
            if (typeof cbOrArray === 'function') return cbOrArray(prisma);
            return Promise.all(cbOrArray);
        });

        const module = await Test.createTestingModule({
            providers: [
                FardosService,
                { provide: PrismaService, useValue: prisma },
                { provide: GruposWhatsappService, useValue: mockGruposService },
            ],
        }).compile();

        service = module.get<FardosService>(FardosService);
    });

    const makeFardo = (overrides: Record<string, any> = {}) => ({
        id: 'fardo-1',
        nombre: 'Fardo Test',
        estado: 'PENDIENTE_APERTURA',
        costoTotal: 10000,
        moneda: 'ARS',
        tipoCambio: null,
        totalPrendas: 0,
        prendas: [],
        proveedor: null,
        ...overrides,
    });

    // ── abrirFardo ───────────────────────────────────────────────────
    describe('abrirFardo', () => {
        const itemBase = { categoriaId: 'cat1', talleId: 'tal1', cantidad: 2, precioVenta: 5000 };

        it('lanza BadRequestException si el fardo está CERRADO', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'CERRADO' }));
            await expect(service.abrirFardo('fardo-1', { items: [itemBase] })).rejects.toThrow(BadRequestException);
        });

        it('lanza BadRequestException si el fardo ya está ABIERTO (no permite re-apertura)', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'ABIERTO' }));
            await expect(service.abrirFardo('fardo-1', { items: [itemBase] })).rejects.toThrow(BadRequestException);
        });

        it('lanza BadRequestException si no se envían prendas (evita división por cero)', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo());
            await expect(service.abrirFardo('fardo-1', { items: [] })).rejects.toThrow(BadRequestException);
        });

        it('lanza BadRequestException si la cantidad de todas las prendas es 0', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo());
            await expect(
                service.abrirFardo('fardo-1', { items: [{ ...itemBase, cantidad: 0 }] }),
            ).rejects.toThrow(BadRequestException);
        });

        it('calcula el costo unitario correctamente en ARS', async () => {
            // $10.000 ARS / 4 prendas = $2.500 por prenda
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ costoTotal: 10000, moneda: 'ARS' }));
            prisma.prenda.create.mockResolvedValue({ id: 'p1' });
            prisma.fardo.update.mockResolvedValue({});

            await service.abrirFardo('fardo-1', {
                items: [{ ...itemBase, cantidad: 4 }],
            });

            const llamadas = prisma.prenda.create.mock.calls;
            expect(llamadas.length).toBe(4);
            expect(llamadas[0][0].data.costoUnitario).toBe(2500);
        });

        it('convierte con tipoCambio para fardos USD', async () => {
            // $100 USD × $1.000 tipoCambio / 2 prendas = $50.000 ARS por prenda
            prisma.fardo.findUnique.mockResolvedValue(
                makeFardo({ costoTotal: 100, moneda: 'USD', tipoCambio: 1000 }),
            );
            prisma.prenda.create.mockResolvedValue({ id: 'p1' });
            prisma.fardo.update.mockResolvedValue({});

            await service.abrirFardo('fardo-1', {
                items: [{ ...itemBase, cantidad: 2 }],
            });

            const llamadas = prisma.prenda.create.mock.calls;
            expect(llamadas[0][0].data.costoUnitario).toBe(50000);
        });

        it('aplica descuento del 40% en prendas con falla', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo());
            prisma.prenda.create.mockResolvedValue({ id: 'p1' });
            prisma.fardo.update.mockResolvedValue({});

            await service.abrirFardo('fardo-1', {
                items: [{
                    categoriaId: 'cat1',
                    talleId: 'tal1',
                    cantidad: 1,
                    precioVenta: 10000,
                    tieneFalla: true,
                    descripcionFalla: 'Rotura en costura',
                }],
            });

            const llamada = prisma.prenda.create.mock.calls[0][0];
            expect(llamada.data.precioVenta).toBe(6000); // 10000 × 0.6
            expect(llamada.data.estado).toBe('FALLA');
            expect(llamada.data.tieneFalla).toBe(true);
        });

        it('prendas sin falla tienen estado DISPONIBLE y precio completo', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo());
            prisma.prenda.create.mockResolvedValue({ id: 'p1' });
            prisma.fardo.update.mockResolvedValue({});

            await service.abrirFardo('fardo-1', {
                items: [{ ...itemBase, cantidad: 1, precioVenta: 10000 }],
            });

            const llamada = prisma.prenda.create.mock.calls[0][0];
            expect(llamada.data.precioVenta).toBe(10000);
            expect(llamada.data.estado).toBe('DISPONIBLE');
        });

        it('incrementa totalPrendas del fardo con la cantidad correcta', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo());
            prisma.prenda.create.mockResolvedValue({ id: 'p1' });
            prisma.fardo.update.mockResolvedValue({});

            // 2 items: 3 + 2 = 5 prendas
            await service.abrirFardo('fardo-1', {
                items: [
                    { categoriaId: 'cat1', talleId: 'tal1', cantidad: 3, precioVenta: 5000 },
                    { categoriaId: 'cat2', talleId: 'tal2', cantidad: 2, precioVenta: 8000 },
                ],
            });

            expect(prisma.fardo.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ totalPrendas: { increment: 5 } }),
                }),
            );
        });
    });

    // ── cerrar ───────────────────────────────────────────────────────
    describe('cerrar', () => {
        it('lanza BadRequestException si el fardo no está ABIERTO', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'PENDIENTE_APERTURA' }));
            await expect(service.cerrar('fardo-1')).rejects.toThrow(BadRequestException);
        });

        it('marca prendas DISPONIBLE como RETIRADO y el fardo como CERRADO', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'ABIERTO' }));
            prisma.prenda.updateMany.mockResolvedValue({ count: 3 });
            prisma.fardo.update.mockResolvedValue({});

            await service.cerrar('fardo-1');

            expect(prisma.prenda.updateMany).toHaveBeenCalledWith({
                where: { fardoId: 'fardo-1', estado: 'DISPONIBLE' },
                data: { estado: 'RETIRADO' },
            });
            expect(prisma.fardo.update).toHaveBeenCalledWith({
                where: { id: 'fardo-1' },
                data: { estado: 'CERRADO' },
            });
        });
    });

    // ── remove ───────────────────────────────────────────────────────
    describe('remove', () => {
        it('lanza BadRequestException si el fardo ya fue abierto', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'ABIERTO' }));
            await expect(service.remove('fardo-1')).rejects.toThrow(BadRequestException);
        });

        it('no permite eliminar fardos CERRADOS', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'CERRADO' }));
            await expect(service.remove('fardo-1')).rejects.toThrow(BadRequestException);
        });

        it('elimina el fardo correctamente si está en PENDIENTE_APERTURA', async () => {
            prisma.fardo.findUnique.mockResolvedValue(makeFardo({ estado: 'PENDIENTE_APERTURA' }));
            prisma.fardo.delete.mockResolvedValue({});

            await service.remove('fardo-1');

            expect(prisma.fardo.delete).toHaveBeenCalledWith({ where: { id: 'fardo-1' } });
        });
    });

    // ── getRoi ───────────────────────────────────────────────────────
    describe('getRoi', () => {
        it('calcula el ROI correctamente para fardos USD (convierte a ARS)', async () => {
            // $100 USD × $1.000 tipoCambio = $100.000 ARS de costo
            // Ventas: $120.000 ARS → ganancia $20.000 → ROI 20%
            prisma.fardo.findUnique.mockResolvedValue(
                makeFardo({ costoTotal: 100, moneda: 'USD', tipoCambio: 1000, totalPrendas: 4 }),
            );
            prisma.venta.findMany.mockResolvedValue([
                { precioFinal: 60000, costoHistoricoArs: 25000 },
                { precioFinal: 60000, costoHistoricoArs: 25000 },
            ]);

            const result = await service.getRoi('fardo-1');

            expect(result.costoFardo).toBe(100000);
            expect(result.totalVendido).toBe(120000);
            expect(result.ganancia).toBe(20000);
            expect(result.roi).toBe(20);
        });

        it('calcula el ROI correctamente para fardos ARS', async () => {
            prisma.fardo.findUnique.mockResolvedValue(
                makeFardo({ costoTotal: 50000, moneda: 'ARS', totalPrendas: 5 }),
            );
            prisma.venta.findMany.mockResolvedValue([
                { precioFinal: 15000, costoHistoricoArs: 10000 },
                { precioFinal: 15000, costoHistoricoArs: 10000 },
            ]);

            const result = await service.getRoi('fardo-1');

            expect(result.costoFardo).toBe(50000);
            expect(result.totalVendido).toBe(30000);
            expect(result.ganancia).toBe(-20000); // aún no recuperó el costo
            expect(result.roi).toBeLessThan(0);
        });

        it('devuelve ROI 0 si el costo del fardo es 0', async () => {
            prisma.fardo.findUnique.mockResolvedValue(
                makeFardo({ costoTotal: 0, moneda: 'ARS', totalPrendas: 3 }),
            );
            prisma.venta.findMany.mockResolvedValue([]);

            const result = await service.getRoi('fardo-1');

            expect(result.roi).toBe(0);
        });
    });
});
