import { Controller, Get, Put, Post, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { PrendasService } from './prendas.service';
import { UpdatePrendaDto } from './dto/update-prenda.dto';

@Controller('prendas')
export class PrendasController {
    constructor(private readonly prendasService: PrendasService) { }

    // GET /api/v1/prendas?estado=DISPONIBLE&categoriaId=...&talleId=...
    @Get()
    findAll(
        @Query('estado') estado?: string,
        @Query('categoriaId') categoriaId?: string,
        @Query('talleId') talleId?: string,
        @Query('fardoId') fardoId?: string,
    ) {
        return this.prendasService.findAll({ estado, categoriaId, talleId, fardoId });
    }

    // GET /api/v1/prendas/clavos?dias=30
    @Get('clavos')
    findClavos(@Query('dias') dias?: string) {
        return this.prendasService.findClavos(dias ? parseInt(dias) : 30);
    }

    // GET /api/v1/prendas/qr/:qrCode — para el POS (escaneo físico)
    @Get('qr/:qrCode')
    findByQr(@Param('qrCode') qrCode: string) {
        return this.prendasService.findByQr(qrCode);
    }

    // GET /api/v1/prendas/:id
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.prendasService.findOne(id);
    }

    // PUT /api/v1/prendas/:id — actualizar precio, precio promo o estado
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdatePrendaDto) {
        return this.prendasService.update(id, dto);
    }

    // DELETE /api/v1/prendas/:id
    @Delete(':id')
    @HttpCode(204)
    remove(@Param('id') id: string) {
        return this.prendasService.remove(id);
    }

    // POST /api/v1/prendas/:id/fotos — registrar URL de foto ya subida a Supabase Storage
    @Post(':id/fotos')
    addFoto(@Param('id') id: string, @Body() body: { url: string; orden?: number }) {
        return this.prendasService.addFoto(id, body.url, body.orden ?? 0);
    }

    // DELETE /api/v1/prendas/:id/fotos/:fotoId
    @Delete(':id/fotos/:fotoId')
    @HttpCode(204)
    removeFoto(@Param('id') id: string, @Param('fotoId') fotoId: string) {
        return this.prendasService.removeFoto(id, fotoId);
    }
}
