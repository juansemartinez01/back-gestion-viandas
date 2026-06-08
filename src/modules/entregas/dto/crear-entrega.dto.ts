import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CrearEntregaDto {
  @IsUUID()
  @IsNotEmpty()
  pedido_id!: string;

  @IsUUID()
  @IsNotEmpty()
  punto_retiro_id!: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
