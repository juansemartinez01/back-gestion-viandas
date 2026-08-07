import { IsString } from 'class-validator';

export class SyncRoleAdminDto {
  @IsString()
  name!: string;
}
