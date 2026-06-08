import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class QueryDisponiblesDto {
  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;

  @IsOptional()
  @IsUUID()
  punto_retiro_id?: string;
}
