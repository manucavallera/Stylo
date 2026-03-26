import { Module } from '@nestjs/common';
import { PrendasService } from './prendas.service';
import { PrendasController } from './prendas.controller';
import { GruposWhatsappModule } from '../grupos-whatsapp/grupos-whatsapp.module';

@Module({
  imports: [GruposWhatsappModule],
  providers: [PrendasService],
  controllers: [PrendasController]
})
export class PrendasModule {}
