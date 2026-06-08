import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class QueryResumenPrevioDto {
  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;

  @IsUUID()
  @IsNotEmpty()
  punto_retiro_id!: string;
}
