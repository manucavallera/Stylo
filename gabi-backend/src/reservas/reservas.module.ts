import { Module } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { ReservasController } from './reservas.controller';

@Module({
  providers: [ReservasService],
  controllers: [ReservasController]
})
export class ReservasModule {}
