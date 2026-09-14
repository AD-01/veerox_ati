import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));
  // Default port for strategy-service
  await app.listen(3004);
  console.log(`Strategy Service is running on: ${await app.getUrl()}`);
}
bootstrap();

