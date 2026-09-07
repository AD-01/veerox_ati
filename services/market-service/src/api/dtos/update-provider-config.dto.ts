import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateProviderConfigDto {
  @IsString()
  @IsNotEmpty()
  config!: string;
}
