import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TipoSobreproduccion } from '../entities/menu-publicado.entity';

export class UpdateMenuPublicadoDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  puntos_retiro_ids?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  precio_encargo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_sobrante?: number | null;

  @IsOptional()
  @IsISO8601()
  fecha_hora_limite_encargo?: string;

  @IsOptional()
  @IsISO8601()
  fecha_hora_limite_cancelacion?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  limite_maximo_viandas?: number | null;

  @IsOptional()
  @IsEnum(TipoSobreproduccion)
  tipo_sobreproduccion?: TipoSobreproduccion | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor_sobreproduccion?: number | null;

  @IsOptional()
  @IsString()
  imagen_public_id?: string | null;

  @IsOptional()
  @IsString()
  imagen_url?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;
}
