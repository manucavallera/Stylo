import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { FardosService } from './fardos.service';
import { CreateFardoDto } from './dto/create-fardo.dto';
import { AbrirFardoDto } from './dto/abrir-fardo.dto';

@Controller('fardos')
export class FardosController {
    constructor(private readonly fardosService: FardosService) { }

    // POST /api/v1/fardos — registrar compra de fardo
    @Post()
    create(@Body() dto: CreateFardoDto) {
        return this.fardosService.create(dto);
    }

    // GET /api/v1/fardos — listar todos
    @Get()
    findAll() {
        return this.fardosService.findAll();
    }

    // GET /api/v1/fardos/historial — fardos cerrados (debe ir ANTES de :id)
    @Get('historial')
    findHistorial(@Query('skip') skip?: string, @Query('take') take?: string) {
        return this.fardosService.findHistorial(
            skip ? parseInt(skip) : 0,
            take ? parseInt(take) : 20,
        );
    }

    // GET /api/v1/fardos/:id — ver fardo con sus prendas
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.fardosService.findOne(id);
    }

    // POST /api/v1/fardos/:id/abrir — apertura masiva de prendas
    @Post(':id/abrir')
    abrir(@Param('id') id: string, @Body() dto: AbrirFardoDto) {
        return this.fardosService.abrirFardo(id, dto);
    }

    // POST /api/v1/fardos/:id/publicar-grupo — envía prendas al grupo de WhatsApp
    @Post(':id/publicar-grupo')
    publicarAlGrupo(@Param('id') id: string, @Body() body?: { sinFoto?: boolean }) {
        return this.fardosService.publicarAlGrupo(id, body?.sinFoto ?? false);
    }

    // POST /api/v1/fardos/:id/cerrar — archivar fardo
    @Post(':id/cerrar')
    cerrar(@Param('id') id: string) {
        return this.fardosService.cerrar(id);
    }

    // DELETE /api/v1/fardos/:id — eliminar fardo sin prendas
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.fardosService.remove(id);
    }

    // GET /api/v1/fardos/:id/roi — análisis de rentabilidad del fardo
    @Get(':id/roi')
    getRoi(@Param('id') id: string) {
        return this.fardosService.getRoi(id);
    }
}
