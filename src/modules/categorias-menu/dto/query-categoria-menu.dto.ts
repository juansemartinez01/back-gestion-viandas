import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/query/page-query.dto';

export class QueryCategoriaMenuDto extends PageQueryDto {
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
  activa?: boolean;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
