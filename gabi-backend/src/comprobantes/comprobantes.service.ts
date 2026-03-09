import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class ComprobantesService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Generar comprobante para una venta ───────────────────────
    async generarParaVenta(ventaId: string): Promise<Buffer> {
        const venta = await this.prisma.venta.findUnique({
            where: { id: ventaId },
            include: {
                prenda: { include: { categoria: true, talle: true } },
                cliente: true,
                comprobante: true,
            },
        });
        if (!venta) throw new NotFoundException('Venta no encontrada');

        // Obtener o crear el comprobante en la BD
        let comprobante = venta.comprobante;
        if (!comprobante) {
            comprobante = await this.prisma.comprobante.create({
                data: {
                    ventaId,
                    estado: 'EMITIDO',
                },
            });
        }

        // Generar PDF
        const pdfBuffer = await this.generarPDF(venta, comprobante);
        return pdfBuffer;
    }

    private async generarPDF(venta: any, comprobante: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40, size: 'A5' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Encabezado
            doc.fontSize(20).font('Helvetica-Bold').text('COMPROBANTE DE VENTA', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica').text(
                `N° ${String(comprobante.numeroCorrelativo).padStart(4, '0')}`,
                { align: 'center' },
            );
            doc.moveDown(0.5);
            doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
            doc.moveDown(0.5);

            // Datos de la venta
            const fecha = new Date(venta.fechaVenta).toLocaleDateString('es-AR');
            const hora = new Date(venta.fechaVenta).toLocaleTimeString('es-AR');
            doc.fontSize(11);
            doc.text(`Fecha: ${fecha} ${hora}`);
            doc.moveDown(0.3);

            if (venta.cliente) {
                doc.text(`Cliente: ${venta.cliente.nombre}`);
                if (venta.cliente.telefonoWhatsapp) {
                    doc.text(`WhatsApp: ${venta.cliente.telefonoWhatsapp}`);
                }
                doc.moveDown(0.3);
            }

            // Detalle de prenda
            doc.font('Helvetica-Bold').text('Artículo:');
            doc.font('Helvetica');
            doc.text(`  Categoría: ${venta.prenda.categoria?.nombre ?? '-'}`);
            doc.text(`  Talle: ${venta.prenda.talle?.nombre ?? '-'}`);
            doc.text(`  ID Prenda: ${venta.prenda.id}`);
            doc.moveDown(0.5);

            // Precio y pago
            doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(14);
            doc.text(`Total: $${Number(venta.precioFinal).toLocaleString('es-AR')}`, { align: 'right' });
            doc.font('Helvetica').fontSize(11);
            doc.text(`Método de pago: ${venta.metodoPago}`, { align: 'right' });
            doc.moveDown(1);

            // Pie
            doc.fontSize(9).fillColor('gray')
                .text('Gracias por tu compra!', { align: 'center' });

            doc.end();
        });
    }

    // ── Listar comprobantes ──────────────────────────────────────
    findAll() {
        return this.prisma.comprobante.findMany({
            include: { venta: { include: { cliente: true } } },
            orderBy: { fechaEmision: 'desc' },
            take: 50,
        });
    }

    // ── Anular comprobante ───────────────────────────────────────
    async anular(id: string) {
        const comprobante = await this.prisma.comprobante.findUnique({ where: { id } });
        if (!comprobante) throw new NotFoundException('Comprobante no encontrado');
        return this.prisma.comprobante.update({
            where: { id },
            data: { estado: 'ANULADO' },
        });
    }
}
