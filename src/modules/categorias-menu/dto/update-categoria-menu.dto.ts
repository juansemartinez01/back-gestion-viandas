import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCategoriaMenuDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orden_visualizacion?: number;
}
