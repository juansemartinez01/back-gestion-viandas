import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { ok, page } from 'src/common/http/api-response';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { MercadoPagoWebhookLog } from './entities/mercado-pago-webhook-log.entity';
import { QueryWebhookLogDto } from './dto/query-webhook-log.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/mercado-pago')
export class MercadoPagoController {
  constructor(
    @InjectRepository(MercadoPagoWebhookLog)
    private readonly logRepo: Repository<MercadoPagoWebhookLog>,
    private readonly tenancyService: TenancyService,
  ) {}

  @Roles('administrador')
  @Get('logs')
  async listarLogs(@Query() query: QueryWebhookLogDto) {
    const tenantId = this.tenancyService.requireTenantId();
    const currentPage = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.logRepo
      .createQueryBuilder('log')
      .select([
        'log.id',
        'log.pedido_id',
        'log.tipo_evento',
        'log.referencia_externa',
        'log.resultado_procesamiento',
        'log.mensaje_error',
        'log.fecha_recepcion',
        'log.created_at',
      ])
      .where('log.tenant_id = :tenantId', { tenantId })
      .orderBy('log.fecha_recepcion', 'DESC');

    if (query.pedido_id) {
      qb.andWhere('log.pedido_id = :pedidoId', { pedidoId: query.pedido_id });
    }
    if (query.resultado) {
      qb.andWhere('log.resultado_procesamiento = :resultado', { resultado: query.resultado });
    }

    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return page(items, currentPage, limit, total);
  }

  @Roles('administrador')
  @Get('logs/:id')
  async obtenerLog(@Param('id') id: string) {
    const tenantId = this.tenancyService.requireTenantId();

    const log = await this.logRepo
      .createQueryBuilder('log')
      .where('log.id = :id', { id })
      .andWhere('log.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!log) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_WEBHOOK_LOG_NOT_FOUND,
        message: 'Log de webhook no encontrado',
        status: 404,
        details: { id },
      });
    }

    return ok(log);
  }
}
