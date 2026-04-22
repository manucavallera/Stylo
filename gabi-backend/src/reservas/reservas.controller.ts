import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
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
    @Public()
    @Get('activas')
    findActivas() {
        return this.reservasService.findActivas();
    }

    // GET /api/v1/reservas/historial
    @Get('historial')
    findHistorial(@Query('skip') skip?: string, @Query('take') take?: string) {
        return this.reservasService.findHistorial(
            skip ? parseInt(skip) : 0,
            take ? parseInt(take) : 50,
        );
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

    // POST /api/v1/reservas/enviar-recordatorios — llamado por cron de n8n
    @Public()
    @Post('enviar-recordatorios')
    enviarRecordatorios() {
        return this.reservasService.enviarRecordatorios();
    }

    // POST /api/v1/reservas/expirar-vencidas — llamado por cron de n8n
    @Public()
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

    // POST /api/v1/reservas/recibir-comprobante — cliente manda foto del comprobante al bot
    @Public()
    @Post('recibir-comprobante')
    recibirComprobante(@Body() dto: ConfirmarPorBotDto) {
        return this.reservasService.recibirComprobante(dto);
    }

    // POST /api/v1/reservas/confirmar-multiple — confirmar varias reservas juntas con un solo WA
    @Post('confirmar-multiple')
    confirmarMultiple(@Body() dto: { ids: string[]; comprobanteUrl?: string }) {
        return this.reservasService.confirmarMultiple(dto.ids, dto.comprobanteUrl);
    }

    // POST /api/v1/reservas/agregar-carrito-bot — n8n llama esto cuando el cliente manda una foto
    @Public()
    @Post('agregar-carrito-bot')
    agregarAlCarritoBot(@Body() dto: { telefonoWhatsapp: string; prendaId: string }) {
        return this.reservasService.agregarAlCarritoBot(dto);
    }

    // POST /api/v1/reservas/confirmar-carrito-bot — n8n llama esto cuando el cliente responde LISTO
    @Public()
    @Post('confirmar-carrito-bot')
    confirmarCarritoBot(@Body() dto: { telefonoWhatsapp: string; nombreCliente?: string }) {
        return this.reservasService.confirmarCarritoBot(dto);
    }
}
