import { IsUUID, IsString, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

export class EvaluateRiskDto {
  @IsOptional()
  @IsUUID()
  strategyId?: string;

  @IsUUID()
  accountId!: string;

  @IsUUID()
  symbolId!: string;

  @IsString()
  @IsIn(['LONG', 'SHORT'])
  tradeDirection!: 'LONG' | 'SHORT';

  @IsNumber()
  @Min(0.00000001)
  requestedSize!: number;

  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @IsOptional()
  @IsNumber()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  takeProfit?: number;
}
