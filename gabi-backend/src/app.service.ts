import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    const checks: Record<string, { status: string; message?: string }> = {};
    let httpStatus = 200;

    // ── Base de datos ────────────────────────────────────────────
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok' };
    } catch (err: any) {
      checks.database = { status: 'error', message: err.message };
      httpStatus = 503; // DB caída = sistema caído
    }

    // ── Evolution API (WhatsApp) ─────────────────────────────────
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const evolutionKey = process.env.EVOLUTION_API_KEY;
    if (evolutionUrl && evolutionKey) {
      try {
        const res = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
          headers: { apikey: evolutionKey },
          signal: AbortSignal.timeout(5000),
        });
        checks.evolution = res.ok
          ? { status: 'ok' }
          : { status: 'error', message: `HTTP ${res.status}` };
      } catch (err: any) {
        checks.evolution = { status: 'error', message: err.message };
      }
    } else {
      checks.evolution = { status: 'not_configured' };
    }

    // ── n8n ──────────────────────────────────────────────────────
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      // n8n no tiene endpoint de health público — verificamos que el host responda
      const n8nBase = n8nUrl.replace('/webhook', '');
      try {
        await fetch(n8nBase, { signal: AbortSignal.timeout(5000) });
        checks.n8n = { status: 'ok' };
      } catch (err: any) {
        checks.n8n = { status: 'error', message: err.message };
      }
    } else {
      checks.n8n = { status: 'not_configured' };
    }

    const allCriticalOk = checks.database.status === 'ok';
    const anyDegraded = Object.values(checks).some((c) => c.status === 'error');

    return {
      httpStatus,
      body: {
        status: !allCriticalOk ? 'down' : anyDegraded ? 'degraded' : 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        checks,
      },
    };
  }
}
