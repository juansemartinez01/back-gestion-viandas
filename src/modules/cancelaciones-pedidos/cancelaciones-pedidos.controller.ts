import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { ok, page } from 'src/common/http/api-response';
import { CancelacionesPedidosService } from './cancelaciones-pedidos.service';
import { QueryCancelacionesDto } from './dto/query-cancelaciones.dto';
import { ResumenCancelacionesDto } from './dto/resumen-cancelaciones.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/cancelaciones')
export class CancelacionesPedidosController {
  constructor(private readonly svc: CancelacionesPedidosService) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryCancelacionesDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador')
  @Get('devolucion-pendiente')
  async listDevolucionPendiente() {
    const data = await this.svc.listDevolucionPendiente();
    return ok(data);
  }

  @Roles('administrador', 'supervisor')
  @Get('resumen')
  async resumen(@Query() query: ResumenCancelacionesDto) {
    const resumen = await this.svc.resumenDia(query);
    return ok(resumen);
  }
}
