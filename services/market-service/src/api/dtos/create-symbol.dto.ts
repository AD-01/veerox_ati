import { IsString, IsNotEmpty, IsUUID, IsNumber } from 'class-validator';

export class CreateSymbolDto {
  @IsUUID()
  @IsNotEmpty()
  providerId!: string;

  @IsString()
  @IsNotEmpty()
  brokerSymbol!: string;

  @IsString()
  @IsNotEmpty()
  standardSymbol!: string;

  @IsString()
  @IsNotEmpty()
  assetType!: string;

  @IsNumber()
  @IsNotEmpty()
  contractSize!: number;

  @IsNumber()
  @IsNotEmpty()
  tickSize!: number;

  @IsNumber()
  @IsNotEmpty()
  precision!: number;
}
