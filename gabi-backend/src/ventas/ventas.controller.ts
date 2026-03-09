import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';

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

    // GET /api/v1/ventas/:id
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.ventasService.findOne(id);
    }
}
