import { Module } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesController } from './comprobantes.controller';

@Module({
  providers: [ComprobantesService],
  controllers: [ComprobantesController]
})
export class ComprobantesModule {}
