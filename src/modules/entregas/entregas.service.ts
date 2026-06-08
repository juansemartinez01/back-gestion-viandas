import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { auditLogPayload } from 'src/common/audit/audit.util';
import { AuditService } from 'src/modules/audit/audit.service';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { StockViandasService } from 'src/modules/stock-viandas/stock-viandas.service';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { EstadoPedido, MedioPagoPedido } from 'src/modules/pedidos/pedido.enums';
import { StockVianda } from 'src/modules/stock-viandas/entities/stock-vianda.entity';
import { Pago } from 'src/modules/pagos/entities/pago.entity';
import { EstadoPago } from 'src/modules/pagos/pago.enums';
import { EntregaPedido } from './entities/entrega-pedido.entity';
import { CrearEntregaDto } from './dto/crear-entrega.dto';
import { QueryEntregasDto } from './dto/query-entregas.dto';
import { BuscarPorDniDto } from './dto/buscar-por-dni.dto';

@Injectable()
export class EntregasService {
  constructor(
    @InjectRepository(EntregaPedido)
    private readonly entregaRepo: Repository<EntregaPedido>,
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    @InjectRepository(StockVianda)
    private readonly stockRepo: Repository<StockVianda>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    private readonly dataSource: DataSource,
    private readonly tenancyService: TenancyService,
    private readonly auditService: AuditService,
    private readonly stockViandasService: StockViandasService,
  ) {}

  async registrarEntrega(
    dto: CrearEntregaDto,
    usuarioId: string,
  ): Promise<EntregaPedido> {
    const tenantId = this.tenancyService.requireTenantId();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const pedido = await qr.manager
        .getRepository(Pedido)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: dto.pedido_id })
        .andWhere('p.tenant_id = :tenantId', { tenantId })
        .getOne();

      if (!pedido) {
        throw new AppError({
          code: ErrorCodes.PEDIDO_NOT_FOUND,
          message: 'Pedido no encontrado',
          status: 404,
          details: { pedido_id: dto.pedido_id },
        });
      }

      const estadosElegibles: EstadoPedido[] = [
        EstadoPedido.CONFIRMADO_PAGO_ONLINE,
        EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL,
      ];
      if (!estadosElegibles.includes(pedido.estado_pedido)) {
        throw new AppError({
          code: ErrorCodes.ENTREGA_PEDIDO_NO_ENTREGABLE,
          message: 'El pedido no está en un estado que permita la entrega',
          status: 409,
          details: { estado_pedido: pedido.estado_pedido },
        });
      }

      const entregaExistente = await qr.manager
        .getRepository(EntregaPedido)
        .findOne({ where: { pedido_id: dto.pedido_id } });

      if (entregaExistente) {
        throw new AppError({
          code: ErrorCodes.ENTREGA_YA_REGISTRADA,
          message: 'Ya existe una entrega registrada para este pedido',
          status: 409,
          details: { pedido_id: dto.pedido_id },
        });
      }

      const stock = await this.stockRepo.findOne({
        where: {
          tenant_id: tenantId,
          fecha: pedido.fecha_retiro,
          sede_id: pedido.sede_id,
          punto_retiro_id: pedido.punto_retiro_id,
          menu_publicado_id: pedido.menu_publicado_id,
        },
      });

      if (!stock) {
        throw new AppError({
          code: ErrorCodes.STOCK_VIANDA_NOT_FOUND,
          message: 'No se encontró stock de vianda para este pedido',
          status: 404,
        });
      }

      await this.stockViandasService.consumirParaEntrega(
        stock.id,
        pedido.cantidad,
        pedido.id,
        tenantId,
      );

      let importeCobradoCaja = 0;

      if (pedido.medio_pago === MedioPagoPedido.PRESENCIAL) {
        const pago = await qr.manager
          .getRepository(Pago)
          .createQueryBuilder('p')
          .where('p.pedido_id = :pedidoId', { pedidoId: pedido.id })
          .andWhere('p.tenant_id = :tenantId', { tenantId })
          .getOne();

        if (!pago) {
          throw new AppError({
            code: ErrorCodes.PAGO_NOT_FOUND,
            message: 'No hay pago registrado para este pedido',
            status: 404,
            details: { pedido_id: pedido.id },
          });
        }

        if (pago.estado !== EstadoPago.PRESENCIAL_PENDIENTE) {
          throw new AppError({
            code: ErrorCodes.PAGO_YA_COBRADO,
            message: 'El pago ya fue cobrado o no está en estado de cobro pendiente',
            status: 409,
            details: { pedido_id: pedido.id, estado_pago: pago.estado },
          });
        }

        pago.estado = EstadoPago.PRESENCIAL_COBRADO;
        pago.fecha_registro_presencial = new Date();
        await qr.manager.getRepository(Pago).save(pago);
        importeCobradoCaja = Number(pago.importe);
      }

      pedido.estado_pedido = EstadoPedido.ENTREGADO;
      pedido.fecha_confirmacion = new Date();
      await qr.manager.getRepository(Pedido).save(pedido);

      const entrega = qr.manager.getRepository(EntregaPedido).create({
        tenant_id: tenantId,
        pedido_id: pedido.id,
        sede_id: pedido.sede_id,
        punto_retiro_id: dto.punto_retiro_id,
        usuario_id: usuarioId,
        importe_cobrado_caja: importeCobradoCaja,
        fecha_entrega: new Date(),
        observacion: dto.observacion ?? null,
      });
      const savedEntrega = await qr.manager.getRepository(EntregaPedido).save(entrega);

      await this.auditService.write('admin', {
        actor_user_id: usuarioId,
        action: 'entrega.registrada',
        entity: 'entrega_pedido',
        payload: auditLogPayload({
          actorUserId: usuarioId,
          action: 'entrega.registrada',
          entity: 'entrega_pedido',
          extra: {
            entrega_id: savedEntrega.id,
            pedido_id: pedido.id,
            importe_cobrado_caja: importeCobradoCaja,
          },
        }),
      });

      await qr.commitTransaction();

      savedEntrega.pedido = pedido;
      return savedEntrega;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async buscarPorDni(query: BuscarPorDniDto): Promise<Pedido[]> {
    const tenantId = this.tenancyService.requireTenantId();

    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.menuPublicado', 'mp')
      .leftJoinAndSelect('mp.menuBase', 'mb')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.dni_informado ILIKE :dni', { dni: query.dni })
      .andWhere('p.estado_pedido IN (:...estados)', {
        estados: [
          EstadoPedido.CONFIRMADO_PAGO_ONLINE,
          EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL,
        ],
      })
      .andWhere('p.fecha_retiro = :fecha', { fecha: query.fecha })
      .andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id })
      .andWhere('p.deleted_at IS NULL');

    if (query.punto_retiro_id) {
      qb.andWhere('p.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }

    return qb.orderBy('p.apellido_informado', 'ASC').getMany();
  }

  async list(query: QueryEntregasDto): Promise<{
    items: EntregaPedido[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.tenancyService.requireTenantId();
    const pageNum = query.page ?? 1;
    const limitNum = query.limit ?? 20;
    const skip = (pageNum - 1) * limitNum;

    const qb = this.entregaRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.pedido', 'p')
      .where('e.tenant_id = :tenantId', { tenantId });

    if (query.fecha_desde) {
      qb.andWhere('e.fecha_entrega >= :fechaDesde', {
        fechaDesde: query.fecha_desde,
      });
    }
    if (query.fecha_hasta) {
      qb.andWhere('e.fecha_entrega <= :fechaHasta', {
        fechaHasta: query.fecha_hasta,
      });
    }
    if (query.sede_id) {
      qb.andWhere('e.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('e.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }
    if (query.usuario_id) {
      qb.andWhere('e.usuario_id = :usuarioId', {
        usuarioId: query.usuario_id,
      });
    }

    qb.orderBy('e.fecha_entrega', 'DESC');

    const [items, total] = await qb.skip(skip).take(limitNum).getManyAndCount();

    return { items, total, page: pageNum, limit: limitNum };
  }

  async findOne(id: string): Promise<EntregaPedido> {
    const tenantId = this.tenancyService.requireTenantId();

    const entrega = await this.entregaRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.pedido', 'p')
      .where('e.id = :id', { id })
      .andWhere('e.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!entrega) {
      throw new AppError({
        code: ErrorCodes.ENTREGA_NOT_FOUND,
        message: 'Entrega no encontrada',
        status: 404,
        details: { id },
      });
    }

    return entrega;
  }
}
