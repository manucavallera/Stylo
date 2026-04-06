import { Controller, Get, Post, Body, Param, HttpCode, Query } from '@nestjs/common';
import { CajaService } from './caja.service';
import { AbrirCajaDto, CerrarCajaDto, RegistrarGastoDto } from './dto/caja.dto';

@Controller('caja')
export class CajaController {
    constructor(private readonly cajaService: CajaService) { }

    @Post('abrir')
    abrir(@Body() dto: AbrirCajaDto) {
        return this.cajaService.abrir(dto);
    }

    @Get('hoy')
    cajaHoy() {
        return this.cajaService.cajaHoy();
    }

    @Get()
    findAll(@Query('skip') skip?: string, @Query('take') take?: string) {
        return this.cajaService.findAll(
            skip ? parseInt(skip) : 0,
            take ? parseInt(take) : 14,
        );
    }

    @Post(':id/cerrar')
    cerrar(@Param('id') id: string, @Body() dto: CerrarCajaDto) {
        return this.cajaService.cerrar(id, dto);
    }

    @Post(':id/gasto')
    registrarGasto(@Param('id') id: string, @Body() dto: RegistrarGastoDto) {
        return this.cajaService.registrarGasto(id, dto);
    }

    @Get(':id/gastos')
    obtenerGastos(@Param('id') id: string) {
        return this.cajaService.obtenerGastos(id);
    }
}
