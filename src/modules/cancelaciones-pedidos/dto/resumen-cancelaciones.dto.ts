import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ResumenCancelacionesDto {
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsUUID()
  sede_id?: string;
}
