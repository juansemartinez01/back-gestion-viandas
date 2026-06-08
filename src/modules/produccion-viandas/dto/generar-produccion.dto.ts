import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class GenerarProduccionDto {
  @IsNotEmpty()
  @IsDateString()
  fecha_produccion!: string;

  @IsNotEmpty()
  @IsUUID()
  sede_id!: string;
}
