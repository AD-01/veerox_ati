import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './env';

async function bootstrap() {
  const env = validateEnv();
  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
}
bootstrap();
