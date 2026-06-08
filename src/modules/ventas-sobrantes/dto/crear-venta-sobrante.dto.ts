import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CrearVentaSobranteDto {
  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;

  @IsUUID()
  @IsNotEmpty()
  punto_retiro_id!: string;

  @IsUUID()
  @IsNotEmpty()
  menu_publicado_id!: string;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  cantidad!: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}
