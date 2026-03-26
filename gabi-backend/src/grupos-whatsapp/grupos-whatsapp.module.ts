import { Module } from '@nestjs/common';
import { GruposWhatsappService } from './grupos-whatsapp.service';
import { GruposWhatsappController } from './grupos-whatsapp.controller';

@Module({
    controllers: [GruposWhatsappController],
    providers: [GruposWhatsappService],
    exports: [GruposWhatsappService],
})
export class GruposWhatsappModule { }
