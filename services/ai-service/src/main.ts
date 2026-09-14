import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './env';

async function bootstrap() {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  await app.listen(env.PORT);
}
bootstrap();

