import { Controller, Get, Post, Put, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { GruposWhatsappService } from './grupos-whatsapp.service';

@Controller('grupos-whatsapp')
export class GruposWhatsappController {
    constructor(private readonly service: GruposWhatsappService) { }

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Post()
    crear(@Body() body: { nombre: string; groupId: string }) {
        return this.service.crear(body);
    }

    @Put(':id')
    actualizar(
        @Param('id') id: string,
        @Body() body: { nombre?: string; groupId?: string; activo?: boolean },
    ) {
        return this.service.actualizar(id, body);
    }

    @Delete(':id')
    @HttpCode(204)
    eliminar(@Param('id') id: string) {
        return this.service.eliminar(id);
    }
}
