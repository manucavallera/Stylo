import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PrendasService } from './prendas.service';
import { PrismaService } from '../prisma/prisma.service';
import { GruposWhatsappService } from '../grupos-whatsapp/grupos-whatsapp.service';

const makePrisma = () => ({
    prenda: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    fotoPrenda: {
        create: jest.fn(),
        deleteMany: jest.fn(),
    },
    fardo: {
        update: jest.fn(),
    },
    $transaction: jest.fn(),
});

const mockGruposService = {
    findActivos: jest.fn().mockResolvedValue([]),
};

describe('PrendasService', () => {
    let service: PrendasService;
    let prisma: ReturnType<typeof makePrisma>;

    beforeEach(async () => {
        prisma = makePrisma();
        prisma.$transaction.mockImplementation((cbOrArray) => {
            if (typeof cbOrArray === 'function') return cbOrArray(prisma);
            return Promise.all(cbOrArray);
        });

        const module = await Test.createTestingModule({
            providers: [
                PrendasService,
                { provide: PrismaService, useValue: prisma },
                { provide: GruposWhatsappService, useValue: mockGruposService },
            ],
        }).compile();

        service = module.get<PrendasService>(PrendasService);
    });

    // ── findOne ──────────────────────────────────────────────────────
    describe('findOne', () => {
        it('lanza NotFoundException si la prenda no existe', async () => {
            prisma.prenda.findUnique.mockResolvedValue(null);
            await expect(service.findOne('p-no-existe')).rejects.toThrow(NotFoundException);
        });

        it('devuelve la prenda si existe', async () => {
            const mockPrenda = { id: 'p1', estado: 'DISPONIBLE', fotos: [] };
            prisma.prenda.findUnique.mockResolvedValue(mockPrenda);
            const result = await service.findOne('p1');
            expect(result).toEqual(mockPrenda);
        });
    });

    // ── remove ───────────────────────────────────────────────────────
    describe('remove', () => {
        it('lanza BadRequestException si la prenda ya fue vendida', async () => {
            prisma.prenda.findUnique.mockResolvedValue({
                id: 'p1',
                fardoId: 'f1',
                venta: { id: 'v1' },
                fotos: [],
                reservas: [],
            });
            await expect(service.remove('p1')).rejects.toThrow(BadRequestException);
        });

        it('elimina la prenda y decrementa totalPrendas del fardo', async () => {
            prisma.prenda.findUnique.mockResolvedValue({
                id: 'p1',
                fardoId: 'f1',
                venta: null,
                fotos: [],
                reservas: [],
            });
            prisma.prenda.delete.mockResolvedValue({});
            prisma.fardo.update.mockResolvedValue({});

            await service.remove('p1');

            expect(prisma.prenda.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
            expect(prisma.fardo.update).toHaveBeenCalledWith({
                where: { id: 'f1' },
                data: { totalPrendas: { decrement: 1 } },
            });
        });
    });

    // ── addFoto ──────────────────────────────────────────────────────
    describe('addFoto', () => {
        it('lanza NotFoundException si la prenda no existe', async () => {
            prisma.prenda.findUnique.mockResolvedValue(null);
            await expect(service.addFoto('p-no-existe', 'http://foto.jpg', 0)).rejects.toThrow(NotFoundException);
        });

        it('agrega la foto correctamente', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', fotos: [], venta: null, reservas: [] });
            prisma.fotoPrenda.create.mockResolvedValue({ id: 'foto1', url: 'http://foto.jpg', orden: 0 });

            const result = await service.addFoto('p1', 'http://foto.jpg', 0);

            expect(prisma.fotoPrenda.create).toHaveBeenCalledWith({
                data: { prendaId: 'p1', url: 'http://foto.jpg', orden: 0 },
            });
            expect(result).toMatchObject({ url: 'http://foto.jpg' });
        });
    });

    // ── update ───────────────────────────────────────────────────────
    describe('update', () => {
        it('lanza NotFoundException si la prenda no existe', async () => {
            prisma.prenda.findUnique.mockResolvedValue(null);
            await expect(service.update('p-no-existe', { precioVenta: 10000 })).rejects.toThrow(NotFoundException);
        });

        it('actualiza la prenda correctamente', async () => {
            prisma.prenda.findUnique.mockResolvedValue({ id: 'p1', fotos: [], venta: null, reservas: [] });
            prisma.prenda.update.mockResolvedValue({ id: 'p1', precioVenta: 10000 });

            const result = await service.update('p1', { precioVenta: 10000 });

            expect(prisma.prenda.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { precioVenta: 10000 },
            });
            expect(result).toMatchObject({ precioVenta: 10000 });
        });
    });
});
