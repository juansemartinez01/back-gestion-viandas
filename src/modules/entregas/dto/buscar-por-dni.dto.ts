import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class BuscarPorDniDto {
  @IsString()
  @IsNotEmpty()
  dni!: string;

  @IsDateString()
  @IsNotEmpty()
  fecha!: string;

  @IsUUID()
  @IsNotEmpty()
  sede_id!: string;

  @IsOptional()
  @IsUUID()
  punto_retiro_id?: string;
}
