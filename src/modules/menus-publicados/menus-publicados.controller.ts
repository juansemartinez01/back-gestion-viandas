import {
  Body,
  Controller,
  Delete,
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
import { PinoLogger } from 'nestjs-pino';
import { ok, page } from 'src/common/http/api-response';
import { MenusPublicadosService } from './menus-publicados.service';
import { CreateMenuPublicadoDto } from './dto/create-menu-publicado.dto';
import { UpdateMenuPublicadoDto } from './dto/update-menu-publicado.dto';
import { QueryMenuPublicadoDto } from './dto/query-menu-publicado.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/menus-publicados')
export class MenusPublicadosController {
  constructor(
    private readonly svc: MenusPublicadosService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryMenuPublicadoDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const mp = await this.svc.findOne(id);
    return ok(mp);
  }

  @Roles('administrador', 'supervisor')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CreateMenuPublicadoDto) {
    const mp = await this.svc.publicar(dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.created',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: mp.id, sede_id: mp.sede_id, fecha_venta: mp.fecha_venta },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.created',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateMenuPublicadoDto) {
    const mp = await this.svc.editarMenuPublicado(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.updated',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id, fields: Object.keys(dto) },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.updated',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/pausar')
  async pausar(@Req() req: any, @Param('id') id: string) {
    const mp = await this.svc.pausar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.pausado',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.pausado',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/reactivar')
  async reactivar(@Req() req: any, @Param('id') id: string) {
    const mp = await this.svc.reactivar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.reactivado',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.reactivado',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/cerrar')
  async cerrar(@Req() req: any, @Param('id') id: string) {
    const mp = await this.svc.cerrar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.cerrado',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.cerrado',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/agotar')
  async agotar(@Req() req: any, @Param('id') id: string) {
    const mp = await this.svc.agotar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.agotado',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.agotado',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/cancelar')
  async cancelar(@Req() req: any, @Param('id') id: string) {
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const mp = await this.svc.cancelar(id, roles);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.cancelado',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.cancelado',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok(mp);
  }

  @Roles('administrador')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_publicado.deleted',
      entity: 'menu_publicado',
      extra: { menuPublicadoId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_publicado.deleted',
      entity: 'menu_publicado',
      payload: auditData,
    });

    return ok({ id });
  }
}
