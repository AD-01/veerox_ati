import { Module } from '@nestjs/common';
import { ExecutionModule } from './execution.module';

@Module({
  imports: [ExecutionModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
