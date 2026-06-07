import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdatePedidoDto {
  @IsOptional()
  @IsString()
  telefono_informado?: string;

  @IsOptional()
  @IsEmail()
  email_informado?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
