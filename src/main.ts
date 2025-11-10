import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In development, allow all origins. In production, use CORS_ORIGINS env var
  const corsOptions = isProduction
    ? {
        origin: process.env.CORS_ORIGINS
          ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
          : ['https://www.goysim.mn', 'https://goysim.mn'],
        credentials: true,
      }
    : {
        origin: true, // Allow all origins in development
        credentials: true,
      };

  console.log(
    `CORS Configuration: ${isProduction ? 'Production' : 'Development'} mode - ${isProduction ? 'Restricted origins' : 'All origins allowed'}`,
  );

  app.enableCors({
    ...corsOptions,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    exposedHeaders: ['Authorization'],
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('eSIM Backend API')
    .setDescription('API documentation for the eSIM backend')
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
      name: 'Authorization',
      description: 'Enter JWT token',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
