import { Module } from '@nestjs/common';
import { FardosService } from './fardos.service';
import { FardosController } from './fardos.controller';
import { GruposWhatsappModule } from '../grupos-whatsapp/grupos-whatsapp.module';

@Module({
  imports: [GruposWhatsappModule],
  providers: [FardosService],
  controllers: [FardosController]
})
export class FardosModule {}
