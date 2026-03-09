import { Module } from '@nestjs/common';
import { FardosService } from './fardos.service';
import { FardosController } from './fardos.controller';

@Module({
  providers: [FardosService],
  controllers: [FardosController]
})
export class FardosModule {}
