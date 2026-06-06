import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { PinoLogger } from 'nestjs-pino';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { AuditService } from 'src/modules/audit/audit.service';
import { ok, page } from 'src/common/http/api-response';
import { ClientesService } from './clientes.service';
import { QueryClienteDto } from './dto/query-cliente.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/clientes')
export class ClientesController {
  constructor(
    private readonly svc: ClientesService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryClienteDto) {
    const { items, total } = await this.svc.list(query);
    return page(items, query.page ?? 1, query.limit ?? 20, total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return ok(await this.svc.findOne(id));
  }

  @Roles('administrador')
  @Patch(':id/bloquear')
  async bloquear(@Req() req: any, @Param('id') id: string) {
    const cl = await this.svc.bloquear(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'cliente.bloqueado',
      entity: 'cliente',
      extra: { clienteId: id, dni: cl.dni, nombre: cl.nombre, apellido: cl.apellido },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'cliente.bloqueado',
      entity: 'cliente',
      payload: auditData,
    });

    return ok(cl);
  }

  @Roles('administrador')
  @Patch(':id/desbloquear')
  async desbloquear(@Req() req: any, @Param('id') id: string) {
    const cl = await this.svc.desbloquear(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'cliente.desbloqueado',
      entity: 'cliente',
      extra: { clienteId: id, dni: cl.dni, nombre: cl.nombre, apellido: cl.apellido },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'cliente.desbloqueado',
      entity: 'cliente',
      payload: auditData,
    });

    return ok(cl);
  }
}
