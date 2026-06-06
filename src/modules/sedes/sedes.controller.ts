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
import { SedesService } from './sedes.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { QuerySedeDto } from './dto/query-sede.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/sedes')
export class SedesController {
  constructor(
    private readonly svc: SedesService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QuerySedeDto) {
    const { items, total } = await this.svc.list(query);
    return page(items, query.page ?? 1, query.limit ?? 20, total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const sede = await this.svc.findOne(id);
    return ok(sede);
  }

  @Roles('administrador')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CreateSedeDto) {
    const sede = await this.svc.create(dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'sede.created',
      entity: 'sede',
      extra: { sedeId: sede.id, nombre: sede.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'sede.created',
      entity: 'sede',
      payload: auditData,
    });

    return ok(sede);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSedeDto,
  ) {
    const sede = await this.svc.update(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'sede.updated',
      entity: 'sede',
      extra: { sedeId: id, fields: Object.keys(dto) },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'sede.updated',
      entity: 'sede',
      payload: auditData,
    });

    return ok(sede);
  }

  @Roles('administrador')
  @Patch(':id/activar')
  async activar(@Req() req: any, @Param('id') id: string) {
    const sede = await this.svc.activar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'sede.activated',
      entity: 'sede',
      extra: { sedeId: id, nombre: sede.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'sede.activated',
      entity: 'sede',
      payload: auditData,
    });

    return ok(sede);
  }

  @Roles('administrador')
  @Patch(':id/inactivar')
  async inactivar(@Req() req: any, @Param('id') id: string) {
    const sede = await this.svc.inactivar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'sede.deactivated',
      entity: 'sede',
      extra: { sedeId: id, nombre: sede.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'sede.deactivated',
      entity: 'sede',
      payload: auditData,
    });

    return ok(sede);
  }

  @Roles('administrador')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'sede.deleted',
      entity: 'sede',
      extra: { sedeId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'sede.deleted',
      entity: 'sede',
      payload: auditData,
    });

    return ok({ id });
  }
}
