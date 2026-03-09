import { Module } from '@nestjs/common';
import { PrendasService } from './prendas.service';
import { PrendasController } from './prendas.controller';

@Module({
  providers: [PrendasService],
  controllers: [PrendasController]
})
export class PrendasModule {}
