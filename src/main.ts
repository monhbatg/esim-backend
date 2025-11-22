import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable CORS
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  // Localhost origins that should always be allowed (for development/testing)
  const localhostOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];

  // In development, allow all origins. In production, use CORS_ORIGINS env var + localhost
  const corsOptions = isProduction
    ? {
        origin: (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void,
        ) => {
          const allowedOrigins = process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
            : ['https://www.goysim.mn', 'https://goysim.mn'];

          // Combine production origins with localhost origins
          const allAllowedOrigins = [...allowedOrigins, ...localhostOrigins];

          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) {
            return callback(null, true);
          }

          // Check if origin is localhost or in allowed list
          const isLocalhost = localhostOrigins.some((lo) =>
            origin.startsWith(lo.replace(/:\d+$/, '')),
          );

          if (allAllowedOrigins.includes(origin) || isLocalhost) {
            callback(null, true);
          } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(
              new Error(
                `Not allowed by CORS. Allowed origins: ${allAllowedOrigins.join(', ')}`,
              ),
            );
          }
        },
        credentials: true,
      }
    : {
        origin: true, // Allow all origins in development
        credentials: true,
      };

  console.log(
    `CORS Configuration: ${isProduction ? 'Production' : 'Development'} mode - ${
      isProduction
        ? `Restricted origins: ${process.env.CORS_ORIGINS || 'default'}`
        : 'All origins allowed'
    }`,
  );

  app.enableCors({
    ...corsOptions,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
    ],
    exposedHeaders: ['Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
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
