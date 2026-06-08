import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';
import { EstadoOrdenProduccion } from '../entities/orden-produccion-vianda.entity';

export class QueryProduccionDto extends PageQueryDto {
  @IsOptional()
  @IsDateString()
  fecha_produccion?: string;

  @IsOptional()
  @IsUUID()
  sede_id?: string;

  @IsOptional()
  @IsUUID()
  punto_retiro_id?: string;

  @IsOptional()
  @IsUUID()
  menu_publicado_id?: string;

  @IsOptional()
  @IsEnum(EstadoOrdenProduccion)
  estado?: EstadoOrdenProduccion;
}
