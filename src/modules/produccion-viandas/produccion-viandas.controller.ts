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
import { ProduccionViandasService } from './produccion-viandas.service';
import { GenerarProduccionDto } from './dto/generar-produccion.dto';
import { ConfirmarProduccionDto } from './dto/confirmar-produccion.dto';
import { QueryProduccionDto } from './dto/query-produccion.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/produccion-viandas')
export class ProduccionViandasController {
  constructor(
    private readonly svc: ProduccionViandasService,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor', 'cocina')
  @Get()
  async list(@Query() query: QueryProduccionDto) {
    const result = await this.svc.list(query);
    return page(result.items, result.page, result.limit, result.total);
  }

  // IMPORTANTE: /imprimible debe declararse ANTES de /:id
  @Roles('administrador', 'supervisor', 'cocina')
  @Get('imprimible')
  async imprimible(@Query() query: QueryProduccionDto) {
    const data = await this.svc.getImprimible(query);
    return ok(data);
  }

  // IMPORTANTE: /generar debe declararse ANTES de /:id
  @Roles('administrador', 'supervisor')
  @Post('generar')
  @HttpCode(200)
  async generar(@Req() req: any, @Body() dto: GenerarProduccionDto) {
    const ordenes = await this.svc.generarProduccion(dto, req.user?.sub);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'produccion.generada',
      entity: 'orden_produccion_vianda',
      extra: {
        fecha_produccion: dto.fecha_produccion,
        sede_id: dto.sede_id,
        ordenes_generadas: ordenes.length,
      },
    });

    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'produccion.generada',
      entity: 'orden_produccion_vianda',
      payload: auditData,
    });

    return ok(ordenes);
  }

  @Roles('administrador', 'supervisor', 'cocina')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const orden = await this.svc.findOrdenById(id);
    return ok(orden);
  }

  @Roles('administrador', 'supervisor')
  @Patch(':id/en-produccion')
  async enProduccion(@Req() req: any, @Param('id') id: string) {
    const orden = await this.svc.marcarEnProduccion(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'produccion.en_produccion',
      entity: 'orden_produccion_vianda',
      extra: { orden_id: id },
    });

    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'produccion.en_produccion',
      entity: 'orden_produccion_vianda',
      payload: auditData,
    });

    return ok(orden);
  }

  @Roles('administrador', 'supervisor')
  @Post(':id/confirmar')
  @HttpCode(200)
  async confirmar(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ConfirmarProduccionDto,
  ) {
    const { orden, alerta } = await this.svc.confirmarProduccion(
      id,
      dto,
      req.user?.sub,
    );

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'produccion.confirmada',
      entity: 'orden_produccion_vianda',
      extra: {
        orden_id: id,
        cantidad_real: dto.cantidad_real_producida,
        diferencia: orden.diferencia,
        estado: orden.estado,
      },
    });

    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'produccion.confirmada',
      entity: 'orden_produccion_vianda',
      payload: auditData,
    });

    return ok({ orden, alerta });
  }
}
