import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearCierreDto {
  @IsDateString()
  @IsNotEmpty()
  fecha_operativa!: string;

  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;

  @IsUUID()
  @IsNotEmpty()
  punto_retiro_id!: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
