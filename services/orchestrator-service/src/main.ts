import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '@veerox/shared';
import { validateEnv } from './env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(3000);
}
bootstrap();
