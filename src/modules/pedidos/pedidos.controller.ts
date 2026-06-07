import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { AuditService } from 'src/modules/audit/audit.service';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { ok, page } from 'src/common/http/api-response';
import { PedidosService } from './pedidos.service';
import { CreatePedidoManualDto } from './dto/create-pedido-manual.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidoDto } from './dto/query-pedido.dto';
import { CancelarPedidoDto } from './dto/cancelar-pedido.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/pedidos')
export class PedidosController {
  constructor(
    private readonly svc: PedidosService,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get()
  async list(@Query() query: QueryPedidoDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const pedido = await this.svc.findOne(id);
    return ok(pedido);
  }

  @Roles('administrador', 'supervisor')
  @Post('manual')
  @HttpCode(201)
  async crearManual(@Req() req: any, @Body() dto: CreatePedidoManualDto) {
    const pedido = await this.svc.crearPedidoManual(dto, req.user?.sub);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'pedido.manual.created',
      entity: 'pedido',
      extra: {
        pedidoId: pedido.id,
        codigoPublico: pedido.codigo_publico,
        menuPublicadoId: pedido.menu_publicado_id,
      },
    });
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'pedido.manual.created',
      entity: 'pedido',
      payload: auditData,
    });

    return ok(pedido);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePedidoDto,
  ) {
    const pedido = await this.svc.updatePedido(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'pedido.updated',
      entity: 'pedido',
      extra: { pedidoId: id, fields: Object.keys(dto) },
    });
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'pedido.updated',
      entity: 'pedido',
      payload: auditData,
    });

    return ok(pedido);
  }

  @Roles('administrador', 'supervisor', 'operador_caja')
  @Post(':id/cancelar')
  async cancelar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelarPedidoDto,
  ) {
    const pedido = await this.svc.cancelarDesdeAdmin(id, dto, req.user?.sub);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'pedido.cancelado.admin',
      entity: 'pedido',
      extra: {
        pedidoId: id,
        canceladoPor: 'administracion',
        motivo: dto.motivo,
      },
    });
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'pedido.cancelado.admin',
      entity: 'pedido',
      payload: auditData,
    });

    return ok(pedido);
  }
}
