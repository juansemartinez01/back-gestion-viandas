import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';
import { SortQueryDto } from 'src/common/query/sort-query.dto';
import { EstadoMenuPublicado } from '../entities/menu-publicado.entity';

export class QueryMenuPublicadoDto extends PageQueryDto {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsDateString()
  fecha_venta?: string;

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
