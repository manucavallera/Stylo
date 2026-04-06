import { PrismaClient } from '@prisma/client';
import * as QRCode from 'qrcode';

const prisma = new PrismaClient();
const FRONTEND_URL = 'https://americano-stylo.gygo4l.easypanel.host';

async function main() {
    const prendas = await prisma.prenda.findMany({ select: { id: true } });
    console.log(`Regenerando QRs para ${prendas.length} prendas...`);

    let ok = 0;
    for (const prenda of prendas) {
        const url = `${FRONTEND_URL}/p/${prenda.id}`;
        const qrCode = await QRCode.toDataURL(url, { width: 200, margin: 1 });
        await prisma.prenda.update({ where: { id: prenda.id }, data: { qrCode } });
        ok++;
        if (ok % 10 === 0) console.log(`  ${ok}/${prendas.length}`);
    }

    console.log(`✓ ${ok} QRs actualizados correctamente`);
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
