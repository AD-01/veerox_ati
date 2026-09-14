import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class GenerateDecisionDto {
  @IsString()
  @IsNotEmpty()
  correlationId!: string;

  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  strategyId!: string;

  @IsString()
  @IsNotEmpty()
  symbolId!: string;

  @IsIn(['LONG', 'SHORT'])
  tradeDirection!: 'LONG' | 'SHORT';

  @IsNumber()
  @Min(0.01)
  requestedSize!: number;

  @IsOptional()
  @IsNumber()
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  takeProfit?: number;

  @IsOptional()
  @IsNumber()
  riskScore?: number;
}
