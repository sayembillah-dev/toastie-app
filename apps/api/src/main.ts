import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { validationExceptionFactory } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  // PM2 reloads a cluster worker by sending SIGINT and waiting for the process
  // to exit before routing traffic to its replacement. Without shutdown hooks
  // Nest never runs `onModuleDestroy`, so in-flight requests are severed and
  // Prisma's pool is torn down by process death rather than closed — which is
  // the difference between a reload being genuinely zero-downtime and merely
  // looking like it. `enableShutdownHooks` registers the signal listeners.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API ready on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
