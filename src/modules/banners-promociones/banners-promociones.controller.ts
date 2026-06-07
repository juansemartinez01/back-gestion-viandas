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
import { BannersPromocionesService } from './banners-promociones.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { QueryBannerDto } from './dto/query-banner.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/banners')
export class BannersPromocionesController {
  constructor(
    private readonly svc: BannersPromocionesService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryBannerDto) {
    const { items, total } = await this.svc.list(query);
    return page(items, query.page ?? 1, query.limit ?? 20, total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const banner = await this.svc.findOne(id);
    return ok(banner);
  }

  @Roles('administrador')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CreateBannerDto) {
    const banner = await this.svc.create(dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'banner.created',
      entity: 'banner',
      extra: { bannerId: banner.id, titulo: banner.titulo },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'banner.created',
      entity: 'banner',
      payload: auditData,
    });

    return ok(banner);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBannerDto) {
    const banner = await this.svc.update(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'banner.updated',
      entity: 'banner',
      extra: { bannerId: id, fields: Object.keys(dto) },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'banner.updated',
      entity: 'banner',
      payload: auditData,
    });

    return ok(banner);
  }

  @Roles('administrador')
  @Patch(':id/activar')
  async activar(@Req() req: any, @Param('id') id: string) {
    const banner = await this.svc.activar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'banner.activated',
      entity: 'banner',
      extra: { bannerId: id, titulo: banner.titulo },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'banner.activated',
      entity: 'banner',
      payload: auditData,
    });

    return ok(banner);
  }

  @Roles('administrador')
  @Patch(':id/inactivar')
  async inactivar(@Req() req: any, @Param('id') id: string) {
    const banner = await this.svc.inactivar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'banner.deactivated',
      entity: 'banner',
      extra: { bannerId: id, titulo: banner.titulo },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'banner.deactivated',
      entity: 'banner',
      payload: auditData,
    });

    return ok(banner);
  }

  @Roles('administrador')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'banner.deleted',
      entity: 'banner',
      extra: { bannerId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'banner.deleted',
      entity: 'banner',
      payload: auditData,
    });

    return ok({ id });
  }
}
