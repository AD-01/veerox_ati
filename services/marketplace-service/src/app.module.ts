import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MarketplaceModule } from './marketplace.module';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';

@Module({
  imports: [
    ObservabilityModule,MarketplaceModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
