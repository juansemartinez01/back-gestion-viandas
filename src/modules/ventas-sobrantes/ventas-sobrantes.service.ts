import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { AuditService } from 'src/modules/audit/audit.service';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { OrdenProduccionVianda, EstadoOrdenProduccion } from 'src/modules/produccion-viandas/entities/orden-produccion-vianda.entity';
import { StockVianda } from 'src/modules/stock-viandas/entities/stock-vianda.entity';
import { MovimientoStockVianda } from 'src/modules/stock-viandas/entities/movimiento-stock-vianda.entity';
import { TipoMovimientoStockVianda } from 'src/modules/stock-viandas/stock-vianda.enums';
import { VentaSobrante } from './entities/venta-sobrante.entity';
import { CrearVentaSobranteDto } from './dto/crear-venta-sobrante.dto';
import { QueryDisponiblesDto } from './dto/query-disponibles.dto';
import { QueryVentasSobrantesDto } from './dto/query-ventas-sobrantes.dto';

const ESTADOS_PRODUCCION_VALIDOS = [
  EstadoOrdenProduccion.CONFIRMADA_COMPLETA,
  EstadoOrdenProduccion.CONFIRMADA_CON_DIFERENCIA,
];

@Injectable()
export class VentasSobrantesService {
  constructor(
    @InjectRepository(VentaSobrante)
    private readonly ventaRepo: Repository<VentaSobrante>,
    @InjectRepository(StockVianda)
    private readonly stockRepo: Repository<StockVianda>,
    @InjectRepository(MenuPublicado)
    private readonly menuPublicadoRepo: Repository<MenuPublicado>,
    @InjectRepository(OrdenProduccionVianda)
    private readonly ordenProduccionRepo: Repository<OrdenProduccionVianda>,
    private readonly dataSource: DataSource,
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
  ) {}

  async registrarVenta(
    dto: CrearVentaSobranteDto,
    usuarioId: string,
  ): Promise<VentaSobrante> {
    const tenantId = this.tenancyService.requireTenantId();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const mp = await qr.manager.findOne(MenuPublicado, {
        where: { id: dto.menu_publicado_id, tenant_id: tenantId },
      });
      if (!mp) {
        throw new AppError({
          code: ErrorCodes.MENU_PUBLICADO_NOT_FOUND,
          message: 'Menú publicado no encontrado',
          status: 404,
          details: { menu_publicado_id: dto.menu_publicado_id },
        });
      }

      const orden = await qr.manager.findOne(OrdenProduccionVianda, {
        where: {
          tenant_id: tenantId,
          fecha_produccion: dto.fecha,
          sede_id: dto.sede_id,
          punto_retiro_id: dto.punto_retiro_id,
          menu_publicado_id: dto.menu_publicado_id,
        },
      });
      if (!orden || !ESTADOS_PRODUCCION_VALIDOS.includes(orden.estado)) {
        throw new AppError({
          code: ErrorCodes.SOBRANTE_PRODUCCION_NO_CONFIRMADA,
          message: 'La producción del día no está confirmada para esta combinación de sede, punto de retiro y menú',
          status: 409,
          details: { fecha: dto.fecha, sede_id: dto.sede_id, estado: orden?.estado ?? null },
        });
      }

      const stock = await qr.manager
        .getRepository(StockVianda)
        .createQueryBuilder('sv')
        .setLock('pessimistic_write')
        .where('sv.tenant_id = :tenantId', { tenantId })
        .andWhere('sv.fecha = :fecha', { fecha: dto.fecha })
        .andWhere('sv.sede_id = :sedeId', { sedeId: dto.sede_id })
        .andWhere('sv.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: dto.punto_retiro_id })
        .andWhere('sv.menu_publicado_id = :mpId', { mpId: dto.menu_publicado_id })
        .getOne();

      if (!stock) {
        throw new AppError({
          code: ErrorCodes.STOCK_VIANDA_NOT_FOUND,
          message: 'Stock de vianda no encontrado para esta combinación',
          status: 404,
          details: { fecha: dto.fecha, sede_id: dto.sede_id },
        });
      }

      const disponible = stock.stock_disponible_sobrantes - stock.stock_vendido_sobrante;
      if (disponible < dto.cantidad) {
        throw new AppError({
          code: ErrorCodes.STOCK_INSUFICIENTE_SOBRANTES,
          message: 'Stock de sobrantes insuficiente',
          status: 409,
          details: { disponible, solicitado: dto.cantidad },
        });
      }

      const precioUnitario = Number(mp.precio_sobrante ?? mp.precio_encargo);
      const importeTotal = precioUnitario * dto.cantidad;

      stock.stock_vendido_sobrante += dto.cantidad;
      stock.stock_restante =
        stock.stock_reservado_encargues -
        stock.stock_entregado +
        stock.stock_disponible_sobrantes -
        stock.stock_vendido_sobrante +
        stock.stock_ajustado;
      await qr.manager.getRepository(StockVianda).save(stock);

      const venta = qr.manager.getRepository(VentaSobrante).create({
        tenant_id: tenantId,
        fecha: dto.fecha,
        sede_id: dto.sede_id,
        punto_retiro_id: dto.punto_retiro_id,
        menu_publicado_id: dto.menu_publicado_id,
        cantidad: dto.cantidad,
        precio_unitario: precioUnitario,
        importe_total: importeTotal,
        usuario_id: usuarioId,
        observacion: dto.observacion ?? null,
      });
      const savedVenta = await qr.manager.getRepository(VentaSobrante).save(venta);

      const movimiento = qr.manager.getRepository(MovimientoStockVianda).create({
        tenant_id: tenantId,
        stock_vianda_id: stock.id,
        tipo_movimiento: TipoMovimientoStockVianda.CONSUMO_SOBRANTE,
        cantidad: -dto.cantidad,
        pedido_id: null,
        venta_sobrante_id: savedVenta.id,
        usuario_id: usuarioId,
        observacion: null,
      });
      await qr.manager.getRepository(MovimientoStockVianda).save(movimiento);

      await this.auditService.write('admin', {
        actor_user_id: usuarioId,
        action: 'venta_sobrante.registrada',
        entity: 'venta_sobrante',
        payload: auditLogPayload({
          actorUserId: usuarioId,
          action: 'venta_sobrante.registrada',
          entity: 'venta_sobrante',
          extra: {
            venta_id: savedVenta.id,
            menu_publicado_id: dto.menu_publicado_id,
            cantidad: dto.cantidad,
            importe_total: importeTotal,
          },
        }),
      });

      await qr.commitTransaction();

      savedVenta.menuPublicado = mp;
      return savedVenta;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async listDisponibles(query: QueryDisponiblesDto): Promise<
    {
      stock_id: string;
      menu_publicado_id: string;
      nombre_menu: string;
      precio_sobrante: number | null;
      precio_encargo: number;
      cantidad_disponible: number;
    }[]
  > {
    const tenantId = this.tenancyService.requireTenantId();

    const qb = this.stockRepo
      .createQueryBuilder('sv')
      .leftJoinAndSelect('sv.menuPublicado', 'mp')
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .where('sv.tenant_id = :tenantId', { tenantId })
      .andWhere('sv.fecha = :fecha', { fecha: query.fecha })
      .andWhere('sv.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere(
        '(sv.stock_disponible_sobrantes - sv.stock_vendido_sobrante) > 0',
      );

    if (query.punto_retiro_id) {
      qb.andWhere('sv.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }

    const stocks = await qb.getMany();

    return stocks.map((sv) => ({
      stock_id: sv.id,
      menu_publicado_id: sv.menu_publicado_id,
      nombre_menu: (sv.menuPublicado as any)?.menuBase?.nombre ?? '',
      precio_sobrante: sv.menuPublicado?.precio_sobrante ?? null,
      precio_encargo: Number(sv.menuPublicado?.precio_encargo ?? 0),
      cantidad_disponible: sv.stock_disponible_sobrantes - sv.stock_vendido_sobrante,
    }));
  }

  async list(query: QueryVentasSobrantesDto): Promise<{
    items: VentaSobrante[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.tenancyService.requireTenantId();
    const pageNum = query.page ?? 1;
    const limitNum = query.limit ?? 20;
    const skip = (pageNum - 1) * limitNum;

    const qb = this.ventaRepo
      .createQueryBuilder('vs')
      .leftJoinAndSelect('vs.menuPublicado', 'mp')
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .where('vs.tenant_id = :tenantId', { tenantId });

    if (query.fecha) {
      qb.andWhere('vs.fecha = :fecha', { fecha: query.fecha });
    }
    if (query.sede_id) {
      qb.andWhere('vs.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('vs.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }
    if (query.menu_publicado_id) {
      qb.andWhere('vs.menu_publicado_id = :mpId', {
        mpId: query.menu_publicado_id,
      });
    }

    qb.orderBy('vs.created_at', 'DESC');

    const [items, total] = await qb.skip(skip).take(limitNum).getManyAndCount();

    return { items, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<VentaSobrante> {
    const tenantId = this.tenancyService.requireTenantId();

    const venta = await this.ventaRepo
      .createQueryBuilder('vs')
      .leftJoinAndSelect('vs.menuPublicado', 'mp')
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .where('vs.id = :id', { id })
      .andWhere('vs.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!venta) {
      throw new AppError({
        code: ErrorCodes.VENTA_SOBRANTE_NOT_FOUND,
        message: 'Venta de sobrante no encontrada',
        status: 404,
        details: { id },
      });
    }

    return venta;
  }
}
