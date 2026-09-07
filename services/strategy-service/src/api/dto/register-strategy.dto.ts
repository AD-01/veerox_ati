import { IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterStrategyDto {
  @IsString()
  name!: string;

  @IsString()
  version!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsIn(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'])
  riskProfile!: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
}
