import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { FardosModule } from './fardos/fardos.module';
import { CategoriasModule } from './categorias/categorias.module';
import { TallesModule } from './talles/talles.module';
import { PrendasModule } from './prendas/prendas.module';
import { ClientesModule } from './clientes/clientes.module';
import { ReservasModule } from './reservas/reservas.module';
import { CajaModule } from './caja/caja.module';
import { VentasModule } from './ventas/ventas.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';
import { GruposWhatsappModule } from './grupos-whatsapp/grupos-whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PrismaModule,
    ProveedoresModule,
    FardosModule,
    CategoriasModule,
    TallesModule,
    PrendasModule,
    ClientesModule,
    ReservasModule,
    CajaModule,
    VentasModule,
    ComprobantesModule,
    GruposWhatsappModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard global: todos los endpoints requieren JWT salvo los marcados @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule { }
