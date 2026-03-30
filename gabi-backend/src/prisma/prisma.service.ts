import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    let intentos = 0;
    while (intentos < 5) {
      try {
        await this.$connect();
        this.logger.log('Conectado a la base de datos');
        return;
      } catch (err) {
        intentos++;
        this.logger.warn(`Reintento ${intentos}/5 — DB no disponible: ${err.message}`);
        await new Promise(r => setTimeout(r, 3000 * intentos));
      }
    }
    throw new Error('No se pudo conectar a la base de datos después de 5 intentos');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
