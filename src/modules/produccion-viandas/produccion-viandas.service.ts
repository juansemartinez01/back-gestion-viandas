import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import {
  EstadoMenuPublicado,
  MenuPublicado,
  TipoSobreproduccion,
} from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { EstadoPedido } from 'src/modules/pedidos/pedido.enums';
import { StockViandasService } from 'src/modules/stock-viandas/stock-viandas.service';
import {
  EstadoOrdenProduccion,
  OrdenProduccionVianda,
} from './entities/orden-produccion-vianda.entity';
import { GenerarProduccionDto } from './dto/generar-produccion.dto';
import { ConfirmarProduccionDto } from './dto/confirmar-produccion.dto';
import { QueryProduccionDto } from './dto/query-produccion.dto';

@Injectable()
export class ProduccionViandasService extends BaseCrudTenantService<OrdenProduccionVianda> {
  constructor(
    @InjectRepository(OrdenProduccionVianda)
    private readonly ordenRepo: Repository<OrdenProduccionVianda>,
    @InjectRepository(MenuPublicado)
    private readonly menuPublicadoRepo: Repository<MenuPublicado>,
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    @Inject(forwardRef(() => StockViandasService))
    private readonly stockViandasService: StockViandasService,
  ) {
    super(ordenRepo);
  }

  async generarProduccion(
    dto: GenerarProduccionDto,
    usuarioId: string,
  ): Promise<OrdenProduccionVianda[]> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;

    const menus = await this.menuPublicadoRepo
      .createQueryBuilder('mp')
      .leftJoinAndSelect('mp.menuBase', 'menuBase')
      .where('mp.tenant_id = :tenantId', { tenantId })
      .andWhere('mp.fecha_venta = :fecha', { fecha: dto.fecha_produccion })
      .andWhere('mp.sede_id = :sedeId', { sedeId: dto.sede_id })
      .andWhere('mp.estado = :estado', { estado: EstadoMenuPublicado.ACTIVO })
      .andWhere('mp.deleted_at IS NULL')
      .getMany();

    const ordenes: OrdenProduccionVianda[] = [];

    for (const mp of menus) {
      const onlineRows: { punto_retiro_id: string; total: string }[] =
        await this.pedidoRepo
          .createQueryBuilder('p')
          .select('p.punto_retiro_id', 'punto_retiro_id')
          .addSelect('COUNT(*)', 'total')
          .where('p.tenant_id = :tenantId', { tenantId })
          .andWhere('p.menu_publicado_id = :mpId', { mpId: mp.id })
          .andWhere('p.estado_pedido = :estado', {
            estado: EstadoPedido.CONFIRMADO_PAGO_ONLINE,
          })
          .andWhere('p.deleted_at IS NULL')
          .groupBy('p.punto_retiro_id')
          .getRawMany();

      const presencialRows: { punto_retiro_id: string; total: string }[] =
        await this.pedidoRepo
          .createQueryBuilder('p')
          .select('p.punto_retiro_id', 'punto_retiro_id')
          .addSelect('COUNT(*)', 'total')
          .where('p.tenant_id = :tenantId', { tenantId })
          .andWhere('p.menu_publicado_id = :mpId', { mpId: mp.id })
          .andWhere('p.estado_pedido = :estado', {
            estado: EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL,
          })
          .andWhere('p.deleted_at IS NULL')
          .groupBy('p.punto_retiro_id')
          .getRawMany();

      const cancelacionRows: { punto_retiro_id: string; total: string }[] =
        await this.pedidoRepo
          .createQueryBuilder('p')
          .select('p.punto_retiro_id', 'punto_retiro_id')
          .addSelect('COUNT(*)', 'total')
          .where('p.tenant_id = :tenantId', { tenantId })
          .andWhere('p.menu_publicado_id = :mpId', { mpId: mp.id })
          .andWhere('p.estado_pedido = :estado', {
            estado: EstadoPedido.CANCELADO,
          })
          .andWhere('p.deleted_at IS NULL')
          .groupBy('p.punto_retiro_id')
          .getRawMany();

      const mapaOnline = Object.fromEntries(
        onlineRows.map((r) => [r.punto_retiro_id, Number(r.total)]),
      );
      const mapaPresencial = Object.fromEntries(
        presencialRows.map((r) => [r.punto_retiro_id, Number(r.total)]),
      );
      const mapaCancelaciones = Object.fromEntries(
        cancelacionRows.map((r) => [r.punto_retiro_id, Number(r.total)]),
      );

      const puntosIds = Array.from(
        new Set([
          ...onlineRows.map((r) => r.punto_retiro_id),
          ...presencialRows.map((r) => r.punto_retiro_id),
          ...cancelacionRows.map((r) => r.punto_retiro_id),
        ]),
      );

      // Si no hay pedidos ni cancelaciones, igual generamos con sobreproducción si existe
      if (
        puntosIds.length === 0 &&
        (!mp.valor_sobreproduccion || mp.valor_sobreproduccion === 0)
      ) {
        continue;
      }

      // Normalizar a al menos un punto de retiro vacío si no hay pedidos
      const effectivePuntos =
        puntosIds.length > 0 ? puntosIds : [];

      for (const puntoRetiroId of effectivePuntos) {
        const online = mapaOnline[puntoRetiroId] ?? 0;
        const presencial = mapaPresencial[puntoRetiroId] ?? 0;
        const cancelaciones = mapaCancelaciones[puntoRetiroId] ?? 0;
        const totalPedidos = online + presencial;

        let sobreproduccion = 0;
        if (mp.tipo_sobreproduccion && mp.valor_sobreproduccion !== null) {
          if (mp.tipo_sobreproduccion === TipoSobreproduccion.CANTIDAD_FIJA) {
            sobreproduccion = Number(mp.valor_sobreproduccion);
          } else {
            sobreproduccion = Math.ceil(
              (totalPedidos * Number(mp.valor_sobreproduccion)) / 100,
            );
          }
        }

        const totalSugerido = Math.max(
          0,
          online + presencial - cancelaciones + sobreproduccion,
        );

        const existente = await this.ordenRepo.findOne({
          where: {
            tenant_id: tenantId,
            fecha_produccion: dto.fecha_produccion,
            sede_id: dto.sede_id,
            punto_retiro_id: puntoRetiroId,
            menu_publicado_id: mp.id,
          },
        });

        if (!existente) {
          const nueva = this.ordenRepo.create({
            tenant_id: tenantId,
            fecha_produccion: dto.fecha_produccion,
            sede_id: dto.sede_id,
            punto_retiro_id: puntoRetiroId,
            menu_publicado_id: mp.id,
            cantidad_pago_online: online,
            cantidad_pago_presencial: presencial,
            cantidad_cancelaciones_descontadas: cancelaciones,
            sobreproduccion_configurada: sobreproduccion,
            total_sugerido: totalSugerido,
            estado: EstadoOrdenProduccion.PENDIENTE,
          });
          const guardada = await this.ordenRepo.save(nueva);
          ordenes.push(guardada);
        } else if (
          existente.estado === EstadoOrdenProduccion.PENDIENTE ||
          existente.estado === EstadoOrdenProduccion.EN_PRODUCCION
        ) {
          existente.cantidad_pago_online = online;
          existente.cantidad_pago_presencial = presencial;
          existente.cantidad_cancelaciones_descontadas = cancelaciones;
          existente.sobreproduccion_configurada = sobreproduccion;
          existente.total_sugerido = totalSugerido;
          const actualizada = await this.ordenRepo.save(existente);
          ordenes.push(actualizada);
        }
        // Si ya está confirmada/cancelada → skip
      }
    }

    return ordenes;
  }

  async marcarEnProduccion(id: string): Promise<OrdenProduccionVianda> {
    const orden = await this.mustFindById(id);

    if (orden.estado !== EstadoOrdenProduccion.PENDIENTE) {
      throw new AppError({
        code: ErrorCodes.ORDEN_PRODUCCION_ESTADO_INVALIDO,
        message: 'Solo órdenes en estado pendiente pueden pasar a en_produccion',
        status: 409,
      });
    }

    orden.estado = EstadoOrdenProduccion.EN_PRODUCCION;
    return this.ordenRepo.save(orden);
  }

  async confirmarProduccion(
    id: string,
    dto: ConfirmarProduccionDto,
    usuarioId: string,
  ): Promise<{ orden: OrdenProduccionVianda; alerta: string | null }> {
    const orden = await this.mustFindById(id);

    const estadosPermitidos = [
      EstadoOrdenProduccion.PENDIENTE,
      EstadoOrdenProduccion.EN_PRODUCCION,
    ];

    if (!estadosPermitidos.includes(orden.estado)) {
      throw new AppError({
        code: ErrorCodes.ORDEN_PRODUCCION_ESTADO_INVALIDO,
        message: 'La orden ya fue confirmada o cancelada y no puede modificarse',
        status: 409,
      });
    }

    const diferencia = dto.cantidad_real_producida - orden.total_sugerido;

    if (diferencia !== 0 && (!dto.observacion || dto.observacion.trim() === '')) {
      throw new AppError({
        code: ErrorCodes.PRODUCCION_OBSERVACION_REQUERIDA,
        message:
          'La observación es obligatoria cuando la cantidad producida difiere del total sugerido',
        status: 422,
      });
    }

    orden.cantidad_real_producida = dto.cantidad_real_producida;
    orden.diferencia = diferencia;
    orden.observacion = dto.observacion ?? null;
    orden.usuario_confirmacion_id = usuarioId;
    orden.fecha_confirmacion = new Date();
    orden.estado =
      diferencia === 0
        ? EstadoOrdenProduccion.CONFIRMADA_COMPLETA
        : EstadoOrdenProduccion.CONFIRMADA_CON_DIFERENCIA;

    const ordenGuardada = await this.ordenRepo.save(orden);

    const totalEncargues =
      orden.cantidad_pago_online +
      orden.cantidad_pago_presencial -
      orden.cantidad_cancelaciones_descontadas;

    const alerta =
      dto.cantidad_real_producida < totalEncargues
        ? 'La producción real es inferior al total de encargues confirmados.'
        : null;

    await this.stockViandasService.generarDesdeProduccion(ordenGuardada);

    return { orden: ordenGuardada, alerta };
  }

  async list(query: QueryProduccionDto): Promise<{
    items: OrdenProduccionVianda[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;
    const pageNum = query.page ?? 1;
    const limitNum = query.limit ?? 20;
    const skip = (pageNum - 1) * limitNum;

    const qb = this.ordenRepo
      .createQueryBuilder('orden')
      .leftJoinAndSelect('orden.sede', 'sede')
      .leftJoinAndSelect('orden.puntoRetiro', 'puntoRetiro')
      .leftJoinAndSelect('orden.menuPublicado', 'menuPublicado')
      .leftJoinAndSelect('menuPublicado.menuBase', 'menuBase')
      .where('orden.tenant_id = :tenantId', { tenantId })
      .andWhere('orden.deleted_at IS NULL');

    if (query.fecha_produccion) {
      qb.andWhere('orden.fecha_produccion = :fecha', {
        fecha: query.fecha_produccion,
      });
    }
    if (query.sede_id) {
      qb.andWhere('orden.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('orden.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }
    if (query.menu_publicado_id) {
      qb.andWhere('orden.menu_publicado_id = :mpId', {
        mpId: query.menu_publicado_id,
      });
    }
    if (query.estado) {
      qb.andWhere('orden.estado = :estado', { estado: query.estado });
    }

    qb.orderBy('orden.fecha_produccion', 'DESC')
      .addOrderBy('sede.nombre', 'ASC')
      .addOrderBy('puntoRetiro.nombre', 'ASC');

    const [items, total] = await qb.skip(skip).take(limitNum).getManyAndCount();

    return { items, total, page: pageNum, limit: limitNum };
  }

  async findOrdenById(id: string): Promise<OrdenProduccionVianda> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;

    const orden = await this.ordenRepo
      .createQueryBuilder('orden')
      .leftJoinAndSelect('orden.sede', 'sede')
      .leftJoinAndSelect('orden.puntoRetiro', 'puntoRetiro')
      .leftJoinAndSelect('orden.menuPublicado', 'menuPublicado')
      .leftJoinAndSelect('menuPublicado.menuBase', 'menuBase')
      .where('orden.id = :id', { id })
      .andWhere('orden.tenant_id = :tenantId', { tenantId })
      .andWhere('orden.deleted_at IS NULL')
      .getOne();

    if (!orden) {
      throw new AppError({
        code: ErrorCodes.ORDEN_PRODUCCION_NOT_FOUND,
        message: 'Orden de producción no encontrada',
        status: 404,
      });
    }

    return orden;
  }

  async getImprimible(query: QueryProduccionDto): Promise<object[]> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;

    const qb = this.ordenRepo
      .createQueryBuilder('orden')
      .select('orden.fecha_produccion', 'fecha_produccion')
      .addSelect('sede.nombre', 'sede')
      .addSelect('puntoRetiro.nombre', 'punto_retiro')
      .addSelect('menuBase.nombre', 'menu')
      .addSelect('orden.total_sugerido', 'total_sugerido')
      .addSelect('orden.estado', 'estado')
      .leftJoin('orden.sede', 'sede')
      .leftJoin('orden.puntoRetiro', 'puntoRetiro')
      .leftJoin('orden.menuPublicado', 'menuPublicado')
      .leftJoin('menuPublicado.menuBase', 'menuBase')
      .where('orden.tenant_id = :tenantId', { tenantId })
      .andWhere('orden.deleted_at IS NULL');

    if (query.fecha_produccion) {
      qb.andWhere('orden.fecha_produccion = :fecha', {
        fecha: query.fecha_produccion,
      });
    }
    if (query.sede_id) {
      qb.andWhere('orden.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('orden.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }
    if (query.menu_publicado_id) {
      qb.andWhere('orden.menu_publicado_id = :mpId', {
        mpId: query.menu_publicado_id,
      });
    }
    if (query.estado) {
      qb.andWhere('orden.estado = :estado', { estado: query.estado });
    }

    qb.orderBy('orden.fecha_produccion', 'DESC')
      .addOrderBy('sede.nombre', 'ASC')
      .addOrderBy('puntoRetiro.nombre', 'ASC');

    return qb.getRawMany();
  }
}
