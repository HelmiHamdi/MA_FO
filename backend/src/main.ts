// src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

const compression = require('compression');

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 5000);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  // ─── Security ────────────────────────────────
  app.use(helmet());
  app.use(compression());

  // ─── CORS ─────────────────────────────────────
  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  });

  // ─── Global prefix ───────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validation ──────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger (dev only) ──────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MA_FO — Matchmaking App Frontoffice')
      .setDescription(
        `
## Backend API — Auth, Discovery & B2B Meetings Modules
**Version**: 1.0 | **Tech**: NestJS + Prisma + MySQL

### Modules couverts:
- 🔐 **Auth Module** (1.1, 1.2, 1.3): Email OTP, Phone OTP, QR Code
- 🔍 **Discovery Module** (3.1, 3.2): Swipe Mode, View All, Connections
- 🤝 **B2B Meetings Module** (5.1–5.5): Request, Agenda, Rating, Table QR

### Auth:
Toutes les routes (sauf /auth/*) nécessitent un Bearer token JWT.
        `,
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth Module')
      .addTag('Discovery Module')
      .addTag('B2B Meetings Module')
      .addTag('Notifications Module')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`📚 Swagger: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`🚀 Server running on http://localhost:${port}/api/v1`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`☁️  Photos: Cloudinary CDN`);
}

bootstrap();