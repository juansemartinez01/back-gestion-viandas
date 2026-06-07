import { IsOptional, IsString } from 'class-validator';

export class CancelarPedidoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
