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
        this.iniciarHeartbeat();
        return;
      } catch (err) {
        intentos++;
        this.logger.warn(`Reintento ${intentos}/5 — DB no disponible: ${err.message}`);
        await new Promise(r => setTimeout(r, 3000 * intentos));
      }
    }
    throw new Error('No se pudo conectar a la base de datos después de 5 intentos');
  }

  private iniciarHeartbeat() {
    setInterval(async () => {
      try {
        await this.$queryRaw`SELECT 1`;
      } catch (err) {
        this.logger.warn(`Heartbeat falló, reconectando: ${err.message}`);
        try { await this.$connect(); } catch {}
      }
    }, 30000); // cada 30 segundos
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
