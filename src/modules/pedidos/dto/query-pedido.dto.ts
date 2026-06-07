import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';
import { EstadoPagoPedido, EstadoPedido } from '../pedido.enums';

export class QueryPedidoDto extends PageQueryDto {
  @IsOptional()
  @IsDateString()
  fecha_retiro?: string;

  @IsOptional()
  @IsUUID()
  sede_id?: string;

  @IsOptional()
  @IsUUID()
  punto_retiro_id?: string;

  @IsOptional()
  @IsEnum(EstadoPedido)
  estado_pedido?: EstadoPedido;

  @IsOptional()
  @IsEnum(EstadoPagoPedido)
  estado_pago?: EstadoPagoPedido;

  @IsOptional()
  @IsUUID()
  menu_publicado_id?: string;

  @IsOptional()
  @IsString()
  dni?: string;
}
