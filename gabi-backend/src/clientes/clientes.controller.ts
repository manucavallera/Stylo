import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Controller('clientes')
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) { }

    @Post()
    create(@Body() dto: CreateClienteDto) {
        return this.clientesService.create(dto);
    }

    @Get()
    findAll(
        @Query('skip') skip?: string,
        @Query('take') take?: string,
        @Query('buscar') buscar?: string,
    ) {
        return this.clientesService.findAll(
            skip ? parseInt(skip) : 0,
            take ? parseInt(take) : 50,
            buscar,
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.clientesService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
        return this.clientesService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.clientesService.remove(id);
    }
}
