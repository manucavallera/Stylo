import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // tira error si llegan propiedades extra
      transform: true,       // convierte tipos automáticamente (string -> number, etc.)
    }),
  );

  // Prefijo global de la API
  app.setGlobalPrefix('api/v1');

  // CORS para el frontend Next.js
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Gabi Backend corriendo en: http://localhost:${port}/api/v1`);
}
bootstrap();
