import { IsUUID } from 'class-validator';

export class GetAccountParamsDto {
  @IsUUID()
  accountId!: string;
}
