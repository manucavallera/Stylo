import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfiguracionService {
    constructor(private readonly prisma: PrismaService) { }

    async getConfig() {
        return this.prisma.configuracionTienda.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', minutosReserva: 20 },
            update: {},
        });
    }

    async updateConfig(data: { minutosReserva?: number; aliasCobro?: string; cvuCobro?: string }) {
        return this.prisma.configuracionTienda.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', minutosReserva: data.minutosReserva ?? 20, aliasCobro: data.aliasCobro, cvuCobro: data.cvuCobro },
            update: { minutosReserva: data.minutosReserva, aliasCobro: data.aliasCobro, cvuCobro: data.cvuCobro },
        });
    }
}
