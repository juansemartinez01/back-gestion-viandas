import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AjustarStockDto {
  @IsEnum(['positivo', 'negativo'])
  tipo!: 'positivo' | 'negativo';

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}
