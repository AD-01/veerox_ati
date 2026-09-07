import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class ProcessMarketDataDto {
  @IsDateString()
  @IsNotEmpty()
  timestamp!: string;

  @IsString()
  @IsNotEmpty()
  timeframe!: string;

  @IsNumber()
  @IsNotEmpty()
  open!: number;

  @IsNumber()
  @IsNotEmpty()
  high!: number;

  @IsNumber()
  @IsNotEmpty()
  low!: number;

  @IsNumber()
  @IsNotEmpty()
  close!: number;

  @IsNumber()
  @IsNotEmpty()
  volume!: number;

  @IsBoolean()
  @IsNotEmpty()
  isClosed!: boolean;
}
