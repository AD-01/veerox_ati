import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMarketProviderDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  config!: string;
}
