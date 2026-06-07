import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { ok } from 'src/common/http/api-response';
import { PagosService } from './pagos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/pagos')
export class PagosController {
  constructor(private readonly svc: PagosService) {}

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get(':pedidoId')
  async findByPedidoId(@Param('pedidoId') pedidoId: string) {
    const pago = await this.svc.findByPedidoId(pedidoId);
    return ok(pago);
  }
}
