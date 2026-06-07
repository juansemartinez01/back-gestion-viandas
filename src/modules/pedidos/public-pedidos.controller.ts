import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { PedidosService } from './pedidos.service';
import { CreatePedidoPublicoDto } from './dto/create-pedido-publico.dto';
import { CancelarPedidoDto } from './dto/cancelar-pedido.dto';

@Controller('public/pedidos')
export class PublicPedidosController {
  constructor(private readonly svc: PedidosService) {}

  @Post()
  @HttpCode(201)
  async crear(@Body() dto: CreatePedidoPublicoDto) {
    const pedido = await this.svc.crearPedidoPublico(dto);
    return ok(pedido);
  }

  @Get('consultar')
  async consultar(@Query('dni') dni: string) {
    const pedidos = await this.svc.consultarPorDni(dni);
    return ok(pedidos);
  }

  @Post(':id/cancelar')
  async cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarPedidoDto,
  ) {
    const pedido = await this.svc.cancelarDesdePortal(id, dto);
    return ok(pedido);
  }
}
