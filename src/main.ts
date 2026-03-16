import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS
  app.enableCors();

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('FX Trading App API')
    .setDescription(
      'Backend API for an FX Trading App — user registration, multi-currency wallets, real-time FX rates, currency conversion and trading.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'User registration, OTP verification, and login')
    .addTag('wallet', 'Wallet balances, funding, conversion, and trading')
    .addTag('fx', 'Real-time FX rates')
    .addTag('transactions', 'Transaction history')
    .addTag('admin', 'Admin-only endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api`);
}

bootstrap();
