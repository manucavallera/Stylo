import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { CreateReservaDto, ConfirmarReservaDto, ReservaBotDto, ConfirmarPorBotDto } from './dto/create-reserva.dto';
import { Public } from '../auth/public.decorator';

@Controller('reservas')
export class ReservasController {
    constructor(private readonly reservasService: ReservasService) { }

    // POST /api/v1/reservas
    @Post()
    create(@Body() dto: CreateReservaDto) {
        return this.reservasService.create(dto);
    }

    // GET /api/v1/reservas/activas
    @Get('activas')
    findActivas() {
        return this.reservasService.findActivas();
    }

    // GET /api/v1/reservas/historial
    @Get('historial')
    findHistorial() {
        return this.reservasService.findHistorial();
    }

    // POST /api/v1/reservas/:id/confirmar — cliente pagó
    @Post(':id/confirmar')
    confirmar(@Param('id') id: string, @Body() dto: ConfirmarReservaDto) {
        return this.reservasService.confirmar(id, dto);
    }

    // POST /api/v1/reservas/:id/cancelar
    @Post(':id/cancelar')
    cancelar(@Param('id') id: string) {
        return this.reservasService.cancelar(id);
    }

    // POST /api/v1/reservas/expirar-vencidas — llamado por cron de n8n
    @Post('expirar-vencidas')
    expirarVencidas() {
        return this.reservasService.expirarVencidas();
    }

    // POST /api/v1/reservas/reservar-bot — llamado por n8n al recibir mensaje de WhatsApp
    @Public()
    @Post('reservar-bot')
    reservarDesdeBot(@Body() dto: ReservaBotDto) {
        return this.reservasService.reservarDesdeBot(dto);
    }

    // POST /api/v1/reservas/confirmar-por-bot — cliente manda foto del comprobante al bot
    @Public()
    @Post('confirmar-por-bot')
    confirmarPorBot(@Body() dto: ConfirmarPorBotDto) {
        return this.reservasService.confirmarPorBot(dto);
    }
}
