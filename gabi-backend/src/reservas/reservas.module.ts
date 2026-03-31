import { Module } from '@nestjs/common';
import { ReservasService } from './reservas.service';
import { ReservasController } from './reservas.controller';
import { ConfiguracionModule } from '../configuracion/configuracion.module';

@Module({
  imports: [ConfiguracionModule],
  providers: [ReservasService],
  controllers: [ReservasController]
})
export class ReservasModule {}
