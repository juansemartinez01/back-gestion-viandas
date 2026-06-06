import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSedeDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono_contacto?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden_visualizacion?: number;
}
