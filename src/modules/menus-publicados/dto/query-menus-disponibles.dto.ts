import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class QueryMenusDisponiblesDto {
  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;

  @IsOptional()
  @IsUUID()
  punto_retiro_id?: string;
}
