import { IsNumber, IsPositive, Max, Min, IsNotEmpty } from 'class-validator';

export class ConfigureRiskProfileDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDailyLoss!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDrawdown!: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  maxPositionSize!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  maxOpenPositions!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  marginThreshold!: number;
}
