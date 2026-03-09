import { Controller, Get, Post, Param, Res } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import type { Response } from 'express';

@Controller('comprobantes')
export class ComprobantesController {
    constructor(private readonly comprobantesService: ComprobantesService) { }

    // GET /api/v1/comprobantes — listar comprobantes emitidos
    @Get()
    findAll() {
        return this.comprobantesService.findAll();
    }

    // GET /api/v1/comprobantes/venta/:ventaId — genera y descarga PDF
    @Get('venta/:ventaId')
    async descargarPdf(
        @Param('ventaId') ventaId: string,
        @Res() res: Response,
    ) {
        const pdfBuffer = await this.comprobantesService.generarParaVenta(ventaId);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="comprobante-${ventaId}.pdf"`,
            'Content-Length': pdfBuffer.length,
        });
        res.end(pdfBuffer);
    }

    // POST /api/v1/comprobantes/:id/anular
    @Post(':id/anular')
    anular(@Param('id') id: string) {
        return this.comprobantesService.anular(id);
    }
}
