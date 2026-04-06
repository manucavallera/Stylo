import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { Public } from '../auth/public.decorator';

@Controller('ventas')
export class VentasController {
    constructor(private readonly ventasService: VentasService) { }

    // POST /api/v1/ventas — registrar venta (POS local u online)
    @Post()
    create(@Body() dto: CreateVentaDto) {
        return this.ventasService.create(dto);
    }

    // GET /api/v1/ventas/hoy — ventas del día
    @Get('hoy')
    findHoy() {
        return this.ventasService.findHoy();
    }

    // GET /api/v1/ventas/resumen — resumen por método de pago
    @Get('resumen')
    resumen() {
        return this.ventasService.resumenHoy();
    }

    // GET /api/v1/ventas/resumen-diario — resumen para n8n (público, sin auth)
    @Public()
    @Get('resumen-diario')
    resumenDiario() {
        return this.ventasService.resumenDiario();
    }

    // GET /api/v1/ventas/balance?desde=YYYY-MM-DD&hasta=YYYY-MM-DD — KPIs rápidos
    @Get('balance')
    balance(@Query('desde') desde: string, @Query('hasta') hasta: string) {
        const hoy = new Date().toISOString().split('T')[0];
        return this.ventasService.balance(desde ?? hoy, hasta ?? hoy);
    }

    // GET /api/v1/ventas/balance-detalle?desde=...&hasta=...&skip=0&take=50
    @Get('balance-detalle')
    balanceDetalle(
        @Query('desde') desde: string,
        @Query('hasta') hasta: string,
        @Query('skip') skip?: string,
        @Query('take') take?: string,
    ) {
        const hoy = new Date().toISOString().split('T')[0];
        return this.ventasService.balanceDetalle(
            desde ?? hoy,
            hasta ?? hoy,
            skip ? parseInt(skip) : 0,
            take ? parseInt(take) : 50,
        );
    }

    // GET /api/v1/ventas/huerfanas — ventas sin caja (cualquier fecha)
    @Get('huerfanas')
    huerfanas(@Query('skip') skip?: string, @Query('take') take?: string) {
        return this.ventasService.huerfanas(
            skip ? parseInt(skip) : 0,
            take ? parseInt(take) : 50,
        );
    }

    // GET /api/v1/ventas/:id
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ventasService.findOne(id);
    }

    // DELETE /api/v1/ventas/:id — anular venta
    @Delete(':id')
    anular(@Param('id') id: string) {
        return this.ventasService.anular(id);
    }
}
