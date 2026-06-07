import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { TipoSobreproduccion } from '../entities/menu-publicado.entity';

export class CreateMenuPublicadoDto {
  @IsUUID()
  @IsNotEmpty()
  menu_base_id?: string;

  @IsUUID()
  @IsNotEmpty()
  sede_id?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  puntos_retiro_ids?: string[];

  @IsDateString()
  fecha_venta?: string;

  @IsNumber()
  @Min(0.01)
  precio_encargo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_sobrante?: number;

  @IsISO8601()
  fecha_hora_limite_encargo?: string;

  @IsOptional()
  @IsISO8601()
  fecha_hora_limite_cancelacion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limite_maximo_viandas?: number;

  @IsOptional()
  @IsEnum(TipoSobreproduccion)
  tipo_sobreproduccion?: TipoSobreproduccion;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor_sobreproduccion?: number;

  @IsOptional()
  @IsString()
  imagen_public_id?: string;

  @IsOptional()
  @IsString()
  imagen_url?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
