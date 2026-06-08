import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { AuditService } from 'src/modules/audit/audit.service';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { EstadoPedido } from 'src/modules/pedidos/pedido.enums';
import { EntregaPedido } from 'src/modules/entregas/entities/entrega-pedido.entity';
import { VentaSobrante } from 'src/modules/ventas-sobrantes/entities/venta-sobrante.entity';
import { CierreOperativo } from './entities/cierre-operativo.entity';
import { CrearCierreDto } from './dto/crear-cierre.dto';
import { QueryCierresDto } from './dto/query-cierres.dto';
import { QueryResumenPrevioDto } from './dto/query-resumen-previo.dto';

const ESTADOS_CONFIRMADOS: EstadoPedido[] = [
  EstadoPedido.CONFIRMADO_PAGO_ONLINE,
  EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL,
];

@Injectable()
export class CierresOperativosService {
  constructor(
    @InjectRepository(CierreOperativo)
    private readonly cierreRepo: Repository<CierreOperativo>,
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    @InjectRepository(EntregaPedido)
    private readonly entregaRepo: Repository<EntregaPedido>,
    @InjectRepository(VentaSobrante)
    private readonly ventaRepo: Repository<VentaSobrante>,
    private readonly dataSource: DataSource,
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
  ) {}

  async ejecutarCierre(
    dto: CrearCierreDto,
    usuarioId: string,
  ): Promise<CierreOperativo> {
    const tenantId = this.tenancyService.requireTenantId();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const cierreExistente = await qr.manager.findOne(CierreOperativo, {
        where: {
          tenant_id: tenantId,
          fecha_operativa: dto.fecha_operativa,
          sede_id: dto.sede_id,
          punto_retiro_id: dto.punto_retiro_id,
        },
      });
      if (cierreExistente) {
        throw new AppError({
          code: ErrorCodes.CIERRE_YA_EXISTE,
          message: 'Ya existe un cierre operativo para esta fecha, sede y punto de retiro',
          status: 409,
          details: {
            fecha_operativa: dto.fecha_operativa,
            sede_id: dto.sede_id,
            punto_retiro_id: dto.punto_retiro_id,
          },
        });
      }

      const pedidos = await qr.manager
        .getRepository(Pedido)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.tenant_id = :tenantId', { tenantId })
        .andWhere('p.fecha_retiro = :fecha', { fecha: dto.fecha_operativa })
        .andWhere('p.sede_id = :sedeId', { sedeId: dto.sede_id })
        .andWhere('p.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: dto.punto_retiro_id })
        .andWhere('p.estado_pedido IN (:...estados)', { estados: ESTADOS_CONFIRMADOS })
        .andWhere('p.deleted_at IS NULL')
        .getMany();

      for (const pedido of pedidos) {
        pedido.estado_pedido = EstadoPedido.NO_RETIRADO;
        await qr.manager.getRepository(Pedido).save(pedido);
      }

      const cantidadEntregados = await qr.manager
        .getRepository(EntregaPedido)
        .createQueryBuilder('ep')
        .where('ep.tenant_id = :tenantId', { tenantId })
        .andWhere("DATE(ep.fecha_entrega) = :fecha", { fecha: dto.fecha_operativa })
        .andWhere('ep.sede_id = :sedeId', { sedeId: dto.sede_id })
        .andWhere('ep.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: dto.punto_retiro_id })
        .getCount();

      const recaudacionEntregas = await qr.manager
        .getRepository(EntregaPedido)
        .createQueryBuilder('ep')
        .select('COALESCE(SUM(ep.importe_cobrado_caja), 0)', 'total')
        .where('ep.tenant_id = :tenantId', { tenantId })
        .andWhere("DATE(ep.fecha_entrega) = :fecha", { fecha: dto.fecha_operativa })
        .andWhere('ep.sede_id = :sedeId', { sedeId: dto.sede_id })
        .andWhere('ep.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: dto.punto_retiro_id })
        .getRawOne<{ total: string }>();

      const cantidadVentasSobrantes = await qr.manager
        .getRepository(VentaSobrante)
        .createQueryBuilder('vs')
        .where('vs.tenant_id = :tenantId', { tenantId })
        .andWhere('vs.fecha = :fecha', { fecha: dto.fecha_operativa })
        .andWhere('vs.sede_id = :sedeId', { sedeId: dto.sede_id })
        .andWhere('vs.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: dto.punto_retiro_id })
        .getCount();

      const recaudacionSobrantes = await qr.manager
        .getRepository(VentaSobrante)
        .createQueryBuilder('vs')
        .select('COALESCE(SUM(vs.importe_total), 0)', 'total')
        .where('vs.tenant_id = :tenantId', { tenantId })
        .andWhere('vs.fecha = :fecha', { fecha: dto.fecha_operativa })
        .andWhere('vs.sede_id = :sedeId', { sedeId: dto.sede_id })
        .andWhere('vs.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: dto.punto_retiro_id })
        .getRawOne<{ total: string }>();

      const recaudacionTotal =
        Number(recaudacionEntregas?.total ?? 0) +
        Number(recaudacionSobrantes?.total ?? 0);

      const cierre = qr.manager.getRepository(CierreOperativo).create({
        tenant_id: tenantId,
        fecha_operativa: dto.fecha_operativa,
        sede_id: dto.sede_id,
        punto_retiro_id: dto.punto_retiro_id,
        usuario_id: usuarioId,
        fecha_cierre: new Date(),
        cantidad_pedidos_entregados: cantidadEntregados,
        cantidad_pedidos_no_retirados: pedidos.length,
        cantidad_ventas_sobrantes: cantidadVentasSobrantes,
        recaudacion_presencial: recaudacionTotal,
        observacion: dto.observacion ?? null,
      });
      const savedCierre = await qr.manager.getRepository(CierreOperativo).save(cierre);

      await this.auditService.write('admin', {
        actor_user_id: usuarioId,
        action: 'cierre.operativo.registrado',
        entity: 'cierre_operativo',
        payload: auditLogPayload({
          actorUserId: usuarioId,
          action: 'cierre.operativo.registrado',
          entity: 'cierre_operativo',
          extra: {
            cierre_id: savedCierre.id,
            fecha_operativa: dto.fecha_operativa,
            sede_id: dto.sede_id,
            punto_retiro_id: dto.punto_retiro_id,
            cantidad_pedidos_no_retirados: pedidos.length,
            cantidad_pedidos_entregados: cantidadEntregados,
            recaudacion_presencial: recaudacionTotal,
          },
        }),
      });

      await qr.commitTransaction();
      return savedCierre;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async isDiaCerrado(
    fecha: string,
    sedeId: string,
    puntoRetiroId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await this.cierreRepo.count({
      where: {
        tenant_id: tenantId,
        fecha_operativa: fecha,
        sede_id: sedeId,
        punto_retiro_id: puntoRetiroId,
      },
    });
    return count > 0;
  }

  async calcularResumenPrevio(query: QueryResumenPrevioDto): Promise<{
    fecha: string;
    sede_id: string;
    punto_retiro_id: string;
    cantidad_pedidos_entregados: number;
    cantidad_pedidos_a_no_retirar: number;
    cantidad_pedidos_cancelados: number;
    cantidad_ventas_sobrantes: number;
    recaudacion_presencial_estimada: number;
    dia_ya_cerrado: boolean;
  }> {
    const tenantId = this.tenancyService.requireTenantId();

    const diaYaCerrado = await this.isDiaCerrado(
      query.fecha,
      query.sede_id,
      query.punto_retiro_id,
      tenantId,
    );

    const cantidadEntregados = await this.entregaRepo
      .createQueryBuilder('ep')
      .where('ep.tenant_id = :tenantId', { tenantId })
      .andWhere("DATE(ep.fecha_entrega) = :fecha", { fecha: query.fecha })
      .andWhere('ep.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('ep.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id })
      .getCount();

    const cantidadANoRetirar = await this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.fecha_retiro = :fecha', { fecha: query.fecha })
      .andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('p.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id })
      .andWhere('p.estado_pedido IN (:...estados)', { estados: ESTADOS_CONFIRMADOS })
      .andWhere('p.deleted_at IS NULL')
      .getCount();

    const cantidadCancelados = await this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.fecha_retiro = :fecha', { fecha: query.fecha })
      .andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('p.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id })
      .andWhere('p.estado_pedido = :estado', { estado: EstadoPedido.CANCELADO })
      .andWhere('p.deleted_at IS NULL')
      .getCount();

    const cantidadVentasSobrantes = await this.ventaRepo
      .createQueryBuilder('vs')
      .where('vs.tenant_id = :tenantId', { tenantId })
      .andWhere('vs.fecha = :fecha', { fecha: query.fecha })
      .andWhere('vs.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('vs.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id })
      .getCount();

    const recaudacionEntregas = await this.entregaRepo
      .createQueryBuilder('ep')
      .select('COALESCE(SUM(ep.importe_cobrado_caja), 0)', 'total')
      .where('ep.tenant_id = :tenantId', { tenantId })
      .andWhere("DATE(ep.fecha_entrega) = :fecha", { fecha: query.fecha })
      .andWhere('ep.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('ep.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id })
      .getRawOne<{ total: string }>();

    const recaudacionSobrantes = await this.ventaRepo
      .createQueryBuilder('vs')
      .select('COALESCE(SUM(vs.importe_total), 0)', 'total')
      .where('vs.tenant_id = :tenantId', { tenantId })
      .andWhere('vs.fecha = :fecha', { fecha: query.fecha })
      .andWhere('vs.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('vs.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id })
      .getRawOne<{ total: string }>();

    const recaudacionTotal =
      Number(recaudacionEntregas?.total ?? 0) +
      Number(recaudacionSobrantes?.total ?? 0);

    return {
      fecha: query.fecha,
      sede_id: query.sede_id,
      punto_retiro_id: query.punto_retiro_id,
      cantidad_pedidos_entregados: cantidadEntregados,
      cantidad_pedidos_a_no_retirar: cantidadANoRetirar,
      cantidad_pedidos_cancelados: cantidadCancelados,
      cantidad_ventas_sobrantes: cantidadVentasSobrantes,
      recaudacion_presencial_estimada: recaudacionTotal,
      dia_ya_cerrado: diaYaCerrado,
    };
  }

  async list(query: QueryCierresDto): Promise<{
    items: CierreOperativo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.tenancyService.requireTenantId();
    const pageNum = query.page ?? 1;
    const limitNum = query.limit ?? 20;
    const skip = (pageNum - 1) * limitNum;

    const qb = this.cierreRepo
      .createQueryBuilder('c')
      .where('c.tenant_id = :tenantId', { tenantId });

    if (query.fecha_desde) {
      qb.andWhere('c.fecha_operativa >= :fechaDesde', { fechaDesde: query.fecha_desde });
    }
    if (query.fecha_hasta) {
      qb.andWhere('c.fecha_operativa <= :fechaHasta', { fechaHasta: query.fecha_hasta });
    }
    if (query.sede_id) {
      qb.andWhere('c.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('c.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }

    qb.orderBy('c.fecha_operativa', 'DESC');

    const [items, total] = await qb.skip(skip).take(limitNum).getManyAndCount();
    return { items, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<CierreOperativo> {
    const tenantId = this.tenancyService.requireTenantId();

    const cierre = await this.cierreRepo
      .createQueryBuilder('c')
      .where('c.id = :id', { id })
      .andWhere('c.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!cierre) {
      throw new AppError({
        code: ErrorCodes.CIERRE_OPERATIVO_NOT_FOUND,
        message: 'Cierre operativo no encontrado',
        status: 404,
        details: { id },
      });
    }

    return cierre;
  }
}
