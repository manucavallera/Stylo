import { Module } from '@nestjs/common';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';

@Module({
  providers: [CajaService],
  controllers: [CajaController]
})
export class CajaModule {}
