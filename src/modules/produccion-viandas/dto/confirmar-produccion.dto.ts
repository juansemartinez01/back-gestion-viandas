import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmarProduccionDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  cantidad_real_producida!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  observacion?: string;
}
