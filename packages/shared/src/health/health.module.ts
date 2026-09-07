import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [TerminusModule],
  exports: [TerminusModule],
})
export class HealthModule {}
