import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { MedioPagoPedido } from '../pedido.enums';

export class CreatePedidoManualDto {
  @IsUUID()
  menu_publicado_id!: string;

  @IsUUID()
  punto_retiro_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  dni!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  apellido!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsEnum(MedioPagoPedido)
  medio_pago!: MedioPagoPedido;
}
