import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMenuBaseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagen_public_id?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(1000)
  imagen_url?: string;

  @IsOptional()
  @IsString()
  ingredientes_principales?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  calorias_aprox?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  proteinas_aprox?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  carbohidratos_aprox?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  grasas_aprox?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoria_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  etiqueta_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  alergeno_ids?: string[];
}
