import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';

export class QueryMenuBaseDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsUUID('4')
  categoria_id?: string;

  @IsOptional()
  @IsUUID('4')
  etiqueta_id?: string;

  @IsOptional()
  @IsUUID('4')
  alergeno_id?: string;

  @IsOptional()
  @IsIn(['nombre', 'created_at'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
