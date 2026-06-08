import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';
import { OrigenCancelacion } from 'src/modules/pedidos/pedido.enums';

export class QueryCancelacionesDto extends PageQueryDto {
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsUUID()
  sede_id?: string;

  @IsOptional()
  @IsEnum(OrigenCancelacion)
  cancelado_por?: OrigenCancelacion;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  devolucion_pendiente?: boolean;
}
