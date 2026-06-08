import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { AuditService } from 'src/modules/audit/audit.service';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { OrdenProduccionVianda } from 'src/modules/produccion-viandas/entities/orden-produccion-vianda.entity';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { StockVianda } from './entities/stock-vianda.entity';
import { MovimientoStockVianda } from './entities/movimiento-stock-vianda.entity';
import { TipoMovimientoStockVianda } from './stock-vianda.enums';
import { AjustarStockDto } from './dto/ajustar-stock.dto';
import { QueryStockDto } from './dto/query-stock.dto';

@Injectable()
export class StockViandasService {
  constructor(
    @InjectRepository(StockVianda)
    private readonly stockRepo: Repository<StockVianda>,
    @InjectRepository(MovimientoStockVianda)
    private readonly movimientoRepo: Repository<MovimientoStockVianda>,
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    private readonly dataSource: DataSource,
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
  ) {}

  private calcularRestante(stock: StockVianda): number {
    return (
      stock.stock_reservado_encargues -
      stock.stock_entregado +
      stock.stock_disponible_sobrantes -
      stock.stock_vendido_sobrante +
      stock.stock_ajustado
    );
  }

  async generarDesdeProduccion(
    orden: OrdenProduccionVianda,
  ): Promise<StockVianda> {
    const tenantId = orden.tenant_id as string;
    const encargues =
      orden.cantidad_pago_online + orden.cantidad_pago_presencial;
    const sobrantes = Math.max(
      0,
      (orden.cantidad_real_producida ?? 0) - encargues,
    );

    let stock = await this.stockRepo.findOne({
      where: {
        tenant_id: tenantId,
        fecha: orden.fecha_produccion,
        sede_id: orden.sede_id,
        punto_retiro_id: orden.punto_retiro_id,
        menu_publicado_id: orden.menu_publicado_id,
      },
    });

    if (!stock) {
      stock = this.stockRepo.create({
        tenant_id: tenantId,
        fecha: orden.fecha_produccion,
        sede_id: orden.sede_id,
        punto_retiro_id: orden.punto_retiro_id,
        menu_publicado_id: orden.menu_publicado_id,
        orden_produccion_id: orden.id,
        stock_reservado_encargues: encargues,
        stock_disponible_sobrantes: sobrantes,
        stock_entregado: 0,
        stock_vendido_sobrante: 0,
        stock_ajustado: 0,
      });
    } else {
      stock.orden_produccion_id = orden.id;
      stock.stock_reservado_encargues = encargues;
      stock.stock_disponible_sobrantes = sobrantes;
    }

    stock.stock_restante = this.calcularRestante(stock);
    const saved = await this.stockRepo.save(stock);

    const movimiento = this.movimientoRepo.create({
      tenant_id: tenantId,
      stock_vianda_id: saved.id,
      tipo_movimiento: TipoMovimientoStockVianda.ALTA_PRODUCCION,
      cantidad: orden.cantidad_real_producida ?? 0,
      pedido_id: null,
      venta_sobrante_id: null,
      usuario_id: null,
      observacion: null,
    });
    await this.movimientoRepo.save(movimiento);

    return saved;
  }

  async consumirParaEntrega(
    stockViandaId: string,
    cantidad: number,
    pedidoId: string,
    tenantId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const stock = await em
        .getRepository(StockVianda)
        .createQueryBuilder('sv')
        .setLock('pessimistic_write')
        .where('sv.id = :id', { id: stockViandaId })
        .andWhere('sv.tenant_id = :tenantId', { tenantId })
        .getOne();

      if (!stock) {
        throw new AppError({
          code: ErrorCodes.STOCK_VIANDA_NOT_FOUND,
          message: 'Stock de vianda no encontrado',
          status: 404,
        });
      }

      const disponible = stock.stock_reservado_encargues - stock.stock_entregado;
      if (disponible < cantidad) {
        throw new AppError({
          code: ErrorCodes.STOCK_INSUFICIENTE_ENTREGAS,
          message: 'Stock insuficiente para la entrega',
          status: 409,
        });
      }

      stock.stock_entregado += cantidad;
      stock.stock_restante = this.calcularRestante(stock);
      await em.getRepository(StockVianda).save(stock);

      const movimiento = em.getRepository(MovimientoStockVianda).create({
        tenant_id: tenantId,
        stock_vianda_id: stock.id,
        tipo_movimiento: TipoMovimientoStockVianda.CONSUMO_ENTREGA,
        cantidad: -cantidad,
        pedido_id: pedidoId,
        venta_sobrante_id: null,
        usuario_id: null,
        observacion: null,
      });
      await em.getRepository(MovimientoStockVianda).save(movimiento);
    });
  }

  async consumirParaSobrante(
    stockViandaId: string,
    cantidad: number,
    ventaSobranteId: string,
    tenantId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const stock = await em
        .getRepository(StockVianda)
        .createQueryBuilder('sv')
        .setLock('pessimistic_write')
        .where('sv.id = :id', { id: stockViandaId })
        .andWhere('sv.tenant_id = :tenantId', { tenantId })
        .getOne();

      if (!stock) {
        throw new AppError({
          code: ErrorCodes.STOCK_VIANDA_NOT_FOUND,
          message: 'Stock de vianda no encontrado',
          status: 404,
        });
      }

      const disponible =
        stock.stock_disponible_sobrantes - stock.stock_vendido_sobrante;
      if (disponible < cantidad) {
        throw new AppError({
          code: ErrorCodes.STOCK_INSUFICIENTE_SOBRANTES,
          message: 'Stock de sobrantes insuficiente',
          status: 409,
        });
      }

      stock.stock_vendido_sobrante += cantidad;
      stock.stock_restante = this.calcularRestante(stock);
      await em.getRepository(StockVianda).save(stock);

      const movimiento = em.getRepository(MovimientoStockVianda).create({
        tenant_id: tenantId,
        stock_vianda_id: stock.id,
        tipo_movimiento: TipoMovimientoStockVianda.CONSUMO_SOBRANTE,
        cantidad: -cantidad,
        pedido_id: null,
        venta_sobrante_id: ventaSobranteId,
        usuario_id: null,
        observacion: null,
      });
      await em.getRepository(MovimientoStockVianda).save(movimiento);
    });
  }

  async reasignarCancelacion(
    pedidoId: string,
    tenantId: string,
  ): Promise<void> {
    const pedido = await this.pedidoRepo.findOne({
      where: { id: pedidoId, tenant_id: tenantId },
    });

    if (!pedido) {
      return;
    }

    const stock = await this.stockRepo.findOne({
      where: {
        tenant_id: tenantId,
        fecha: pedido.fecha_pedido,
        sede_id: pedido.sede_id,
        punto_retiro_id: pedido.punto_retiro_id,
        menu_publicado_id: pedido.menu_publicado_id,
      },
    });

    if (!stock) {
      return;
    }

    stock.stock_disponible_sobrantes += 1;
    stock.stock_restante = this.calcularRestante(stock);
    await this.stockRepo.save(stock);

    const movimiento = this.movimientoRepo.create({
      tenant_id: tenantId,
      stock_vianda_id: stock.id,
      tipo_movimiento: TipoMovimientoStockVianda.REASIGNACION_CANCELACION,
      cantidad: 1,
      pedido_id: pedidoId,
      venta_sobrante_id: null,
      usuario_id: null,
      observacion: null,
    });
    await this.movimientoRepo.save(movimiento);
  }

  async ajustarStock(
    id: string,
    dto: AjustarStockDto,
    usuarioId: string,
  ): Promise<StockVianda> {
    const tenantId = this.tenancyService.requireTenantId();

    const stock = await this.stockRepo.findOne({
      where: { id, tenant_id: tenantId },
    });

    if (!stock) {
      throw new AppError({
        code: ErrorCodes.STOCK_VIANDA_NOT_FOUND,
        message: 'Stock de vianda no encontrado',
        status: 404,
      });
    }

    const tipoMovimiento =
      dto.tipo === 'positivo'
        ? TipoMovimientoStockVianda.AJUSTE_POSITIVO
        : TipoMovimientoStockVianda.AJUSTE_NEGATIVO;

    if (dto.tipo === 'positivo') {
      stock.stock_ajustado += dto.cantidad;
    } else {
      stock.stock_ajustado -= dto.cantidad;
    }

    stock.stock_restante = this.calcularRestante(stock);
    const saved = await this.stockRepo.save(stock);

    const movimiento = this.movimientoRepo.create({
      tenant_id: tenantId,
      stock_vianda_id: stock.id,
      tipo_movimiento: tipoMovimiento,
      cantidad: dto.tipo === 'positivo' ? dto.cantidad : -dto.cantidad,
      pedido_id: null,
      venta_sobrante_id: null,
      usuario_id: usuarioId,
      observacion: dto.observacion ?? null,
    });
    await this.movimientoRepo.save(movimiento);

    await this.auditService.write('admin', {
      actor_user_id: usuarioId,
      action: 'stock.ajuste_manual',
      entity: 'stock_vianda',
      payload: auditLogPayload({
        actorUserId: usuarioId,
        action: 'stock.ajuste_manual',
        entity: 'stock_vianda',
        extra: {
          stock_id: id,
          tipo: dto.tipo,
          cantidad: dto.cantidad,
          observacion: dto.observacion ?? null,
        },
      }),
    });

    return saved;
  }

  async list(query: QueryStockDto): Promise<{
    items: StockVianda[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.tenancyService.requireTenantId();
    const pageNum = query.page ?? 1;
    const limitNum = query.limit ?? 20;
    const skip = (pageNum - 1) * limitNum;

    const qb = this.stockRepo
      .createQueryBuilder('sv')
      .leftJoinAndSelect('sv.sede', 'sede')
      .leftJoinAndSelect('sv.puntoRetiro', 'puntoRetiro')
      .leftJoinAndSelect('sv.menuPublicado', 'menuPublicado')
      .leftJoinAndSelect('menuPublicado.menuBase', 'menuBase')
      .where('sv.tenant_id = :tenantId', { tenantId })
      .andWhere('sv.deleted_at IS NULL');

    if (query.fecha) {
      qb.andWhere('sv.fecha = :fecha', { fecha: query.fecha });
    }
    if (query.sede_id) {
      qb.andWhere('sv.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('sv.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }
    if (query.menu_publicado_id) {
      qb.andWhere('sv.menu_publicado_id = :mpId', {
        mpId: query.menu_publicado_id,
      });
    }

    qb.orderBy('sv.fecha', 'DESC')
      .addOrderBy('sede.nombre', 'ASC')
      .addOrderBy('puntoRetiro.nombre', 'ASC');

    const [items, total] = await qb.skip(skip).take(limitNum).getManyAndCount();

    return { items, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<StockVianda> {
    const tenantId = this.tenancyService.requireTenantId();

    const stock = await this.stockRepo
      .createQueryBuilder('sv')
      .leftJoinAndSelect('sv.sede', 'sede')
      .leftJoinAndSelect('sv.puntoRetiro', 'puntoRetiro')
      .leftJoinAndSelect('sv.menuPublicado', 'menuPublicado')
      .leftJoinAndSelect('menuPublicado.menuBase', 'menuBase')
      .where('sv.id = :id', { id })
      .andWhere('sv.tenant_id = :tenantId', { tenantId })
      .andWhere('sv.deleted_at IS NULL')
      .getOne();

    if (!stock) {
      throw new AppError({
        code: ErrorCodes.STOCK_VIANDA_NOT_FOUND,
        message: 'Stock de vianda no encontrado',
        status: 404,
      });
    }

    return stock;
  }

  async listMovimientos(stockViandaId: string): Promise<MovimientoStockVianda[]> {
    const tenantId = this.tenancyService.requireTenantId();

    await this.findOne(stockViandaId);

    return this.movimientoRepo
      .createQueryBuilder('mv')
      .where('mv.stock_vianda_id = :stockId', { stockId: stockViandaId })
      .andWhere('mv.tenant_id = :tenantId', { tenantId })
      .orderBy('mv.created_at', 'ASC')
      .getMany();
  }
}
