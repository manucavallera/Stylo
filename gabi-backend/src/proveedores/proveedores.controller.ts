import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';

@Controller('proveedores')
export class ProveedoresController {
    constructor(private readonly proveedoresService: ProveedoresService) { }

    @Post()
    create(@Body() dto: CreateProveedorDto) {
        return this.proveedoresService.create(dto);
    }

    @Get()
    findAll() {
        return this.proveedoresService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.proveedoresService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateProveedorDto) {
        return this.proveedoresService.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.proveedoresService.remove(id);
    }
}
