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
import { MenusBaseService } from './menus-base.service';
import { CreateMenuBaseDto } from './dto/create-menu-base.dto';
import { UpdateMenuBaseDto } from './dto/update-menu-base.dto';
import { QueryMenuBaseDto } from './dto/query-menu-base.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/menus-base')
export class MenusBaseController {
  constructor(
    private readonly svc: MenusBaseService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryMenuBaseDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const menu = await this.svc.findOne(id);
    return ok(menu);
  }

  @Roles('administrador')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CreateMenuBaseDto) {
    const menu = await this.svc.create(dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_base.created',
      entity: 'menu_base',
      extra: { menuBaseId: menu.id, nombre: menu.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_base.created',
      entity: 'menu_base',
      payload: auditData,
    });

    return ok(menu);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateMenuBaseDto) {
    const menu = await this.svc.update(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_base.updated',
      entity: 'menu_base',
      extra: { menuBaseId: id, fields: Object.keys(dto) },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_base.updated',
      entity: 'menu_base',
      payload: auditData,
    });

    return ok(menu);
  }

  @Roles('administrador')
  @Patch(':id/activar')
  async activar(@Req() req: any, @Param('id') id: string) {
    const menu = await this.svc.activar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_base.activated',
      entity: 'menu_base',
      extra: { menuBaseId: id, nombre: menu.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_base.activated',
      entity: 'menu_base',
      payload: auditData,
    });

    return ok(menu);
  }

  @Roles('administrador')
  @Patch(':id/inactivar')
  async inactivar(@Req() req: any, @Param('id') id: string) {
    const menu = await this.svc.inactivar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_base.deactivated',
      entity: 'menu_base',
      extra: { menuBaseId: id, nombre: menu.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_base.deactivated',
      entity: 'menu_base',
      payload: auditData,
    });

    return ok(menu);
  }

  @Roles('administrador')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'menu_base.deleted',
      entity: 'menu_base',
      extra: { menuBaseId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'menu_base.deleted',
      entity: 'menu_base',
      payload: auditData,
    });

    return ok({ id });
  }
}
