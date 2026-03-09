import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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

    // GET /api/v1/fardos/:id/roi — análisis de rentabilidad del fardo
    @Get(':id/roi')
    getRoi(@Param('id') id: string) {
        return this.fardosService.getRoi(id);
    }
}
