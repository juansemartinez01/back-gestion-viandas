import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';
import { EstadoMenuPublicado } from '../entities/menu-publicado.entity';

export class QueryMenuPublicadoDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['created_at', 'fecha_venta', 'precio_encargo'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsDateString()
  fecha_venta?: string;

  @IsOptional()
  @IsDateString()
  fechaVentaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaVentaHasta?: string;

  @IsOptional()
  @IsUUID()
  sede_id?: string;

  @IsOptional()
  @IsEnum(EstadoMenuPublicado)
  estado?: EstadoMenuPublicado;

  @IsOptional()
  @IsUUID()
  menu_base_id?: string;
}
