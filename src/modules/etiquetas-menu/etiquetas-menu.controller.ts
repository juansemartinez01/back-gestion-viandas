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
import { PinoLogger } from 'nestjs-pino';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { AuditService } from 'src/modules/audit/audit.service';
import { ok, page } from 'src/common/http/api-response';
import { EtiquetasMenuService } from './etiquetas-menu.service';
import { CreateEtiquetaMenuDto } from './dto/create-etiqueta-menu.dto';
import { UpdateEtiquetaMenuDto } from './dto/update-etiqueta-menu.dto';
import { QueryEtiquetaMenuDto } from './dto/query-etiqueta-menu.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/etiquetas-menu')
export class EtiquetasMenuController {
  constructor(
    private readonly svc: EtiquetasMenuService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryEtiquetaMenuDto) {
    const { items, total } = await this.svc.list(query);
    return page(items, query.page ?? 1, query.limit ?? 20, total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const etiqueta = await this.svc.findOne(id);
    return ok(etiqueta);
  }

  @Roles('administrador')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CreateEtiquetaMenuDto) {
    const etiqueta = await this.svc.create(dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'etiqueta_menu.created',
      entity: 'etiqueta_menu',
      extra: { etiquetaMenuId: etiqueta.id, nombre: etiqueta.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'etiqueta_menu.created',
      entity: 'etiqueta_menu',
      payload: auditData,
    });

    return ok(etiqueta);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEtiquetaMenuDto,
  ) {
    const etiqueta = await this.svc.update(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'etiqueta_menu.updated',
      entity: 'etiqueta_menu',
      extra: { etiquetaMenuId: id, fields: Object.keys(dto) },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'etiqueta_menu.updated',
      entity: 'etiqueta_menu',
      payload: auditData,
    });

    return ok(etiqueta);
  }

  @Roles('administrador')
  @Patch(':id/activar')
  async activar(@Req() req: any, @Param('id') id: string) {
    const etiqueta = await this.svc.activar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'etiqueta_menu.activated',
      entity: 'etiqueta_menu',
      extra: { etiquetaMenuId: id, nombre: etiqueta.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'etiqueta_menu.activated',
      entity: 'etiqueta_menu',
      payload: auditData,
    });

    return ok(etiqueta);
  }

  @Roles('administrador')
  @Patch(':id/inactivar')
  async inactivar(@Req() req: any, @Param('id') id: string) {
    const etiqueta = await this.svc.inactivar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'etiqueta_menu.deactivated',
      entity: 'etiqueta_menu',
      extra: { etiquetaMenuId: id, nombre: etiqueta.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'etiqueta_menu.deactivated',
      entity: 'etiqueta_menu',
      payload: auditData,
    });

    return ok(etiqueta);
  }

  @Roles('administrador')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'etiqueta_menu.deleted',
      entity: 'etiqueta_menu',
      extra: { etiquetaMenuId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'etiqueta_menu.deleted',
      entity: 'etiqueta_menu',
      payload: auditData,
    });

    return ok({ id });
  }
}
