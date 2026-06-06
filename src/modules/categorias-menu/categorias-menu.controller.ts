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
import { CategoriasMenuService } from './categorias-menu.service';
import { CreateCategoriaMenuDto } from './dto/create-categoria-menu.dto';
import { UpdateCategoriaMenuDto } from './dto/update-categoria-menu.dto';
import { QueryCategoriaMenuDto } from './dto/query-categoria-menu.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/categorias-menu')
export class CategoriasMenuController {
  constructor(
    private readonly svc: CategoriasMenuService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryCategoriaMenuDto) {
    const { items, total } = await this.svc.list(query);
    return page(items, query.page ?? 1, query.limit ?? 20, total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const cat = await this.svc.findOne(id);
    return ok(cat);
  }

  @Roles('administrador')
  @Post()
  @HttpCode(201)
  async create(@Req() req: any, @Body() dto: CreateCategoriaMenuDto) {
    const cat = await this.svc.create(dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'categoria_menu.created',
      entity: 'categoria_menu',
      extra: { categoriaMenuId: cat.id, nombre: cat.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 201,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'categoria_menu.created',
      entity: 'categoria_menu',
      payload: auditData,
    });

    return ok(cat);
  }

  @Roles('administrador')
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaMenuDto,
  ) {
    const cat = await this.svc.update(id, dto);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'categoria_menu.updated',
      entity: 'categoria_menu',
      extra: { categoriaMenuId: id, fields: Object.keys(dto) },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'categoria_menu.updated',
      entity: 'categoria_menu',
      payload: auditData,
    });

    return ok(cat);
  }

  @Roles('administrador')
  @Patch(':id/activar')
  async activar(@Req() req: any, @Param('id') id: string) {
    const cat = await this.svc.activar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'categoria_menu.activated',
      entity: 'categoria_menu',
      extra: { categoriaMenuId: id, nombre: cat.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'categoria_menu.activated',
      entity: 'categoria_menu',
      payload: auditData,
    });

    return ok(cat);
  }

  @Roles('administrador')
  @Patch(':id/inactivar')
  async inactivar(@Req() req: any, @Param('id') id: string) {
    const cat = await this.svc.inactivar(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'categoria_menu.deactivated',
      entity: 'categoria_menu',
      extra: { categoriaMenuId: id, nombre: cat.nombre },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'categoria_menu.deactivated',
      entity: 'categoria_menu',
      payload: auditData,
    });

    return ok(cat);
  }

  @Roles('administrador')
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.svc.remove(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'categoria_menu.deleted',
      entity: 'categoria_menu',
      extra: { categoriaMenuId: id },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'categoria_menu.deleted',
      entity: 'categoria_menu',
      payload: auditData,
    });

    return ok({ id });
  }
}
