import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ResultadoProcesamiento } from '../entities/mercado-pago-webhook-log.entity';

export class QueryWebhookLogDto {
  @IsOptional()
  @IsUUID()
  pedido_id?: string;

  @IsOptional()
  @IsEnum(ResultadoProcesamiento)
  resultado?: ResultadoProcesamiento;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
