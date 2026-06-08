import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { EstadoPedido } from 'src/modules/pedidos/pedido.enums';
import { QueryCancelacionesDto } from './dto/query-cancelaciones.dto';
import { ResumenCancelacionesDto } from './dto/resumen-cancelaciones.dto';

export interface ResumenCancelacionesResult {
  fecha: string;
  sede_id: string | null;
  total_cancelaciones: number;
  por_cliente: number;
  por_administracion: number;
  con_devolucion_pendiente: number;
}

@Injectable()
export class CancelacionesPedidosService {
  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    private readonly tenancyService: TenancyService,
  ) {}

  async list(query: QueryCancelacionesDto): Promise<{
    items: Pedido[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.tenancyService.requireTenantId();
    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.estado_pedido = :estado', { estado: EstadoPedido.CANCELADO })
      .leftJoinAndSelect('p.sede', 'sede')
      .leftJoinAndSelect('p.puntoRetiro', 'puntoRetiro')
      .leftJoinAndSelect('p.menuPublicado', 'menuPublicado')
      .leftJoinAndSelect('p.cliente', 'cliente');

    if (query.fecha_desde) {
      qb.andWhere('p.fecha_cancelacion >= :fechaDesde', { fechaDesde: query.fecha_desde });
    }
    if (query.fecha_hasta) {
      qb.andWhere('p.fecha_cancelacion <= :fechaHasta', { fechaHasta: query.fecha_hasta });
    }
    if (query.sede_id) {
      qb.andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.cancelado_por) {
      qb.andWhere('p.cancelado_por = :canceladoPor', { canceladoPor: query.cancelado_por });
    }
    if (query.devolucion_pendiente !== undefined) {
      qb.andWhere('p.devolucion_pendiente = :devolucionPendiente', {
        devolucionPendiente: query.devolucion_pendiente,
      });
    }

    qb.orderBy('p.fecha_cancelacion', 'DESC');

    const currentPage = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: currentPage, limit };
  }

  async listDevolucionPendiente(): Promise<Pedido[]> {
    const tenantId = this.tenancyService.requireTenantId();
    return this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.estado_pedido = :estado', { estado: EstadoPedido.CANCELADO })
      .andWhere('p.devolucion_pendiente = true')
      .leftJoinAndSelect('p.sede', 'sede')
      .leftJoinAndSelect('p.cliente', 'cliente')
      .orderBy('p.fecha_cancelacion', 'DESC')
      .getMany();
  }

  async resumenDia(query: ResumenCancelacionesDto): Promise<ResumenCancelacionesResult> {
    const tenantId = this.tenancyService.requireTenantId();
    const fecha = query.fecha ?? new Date().toISOString().split('T')[0];

    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .select('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN p.cancelado_por = 'cliente' THEN 1 ELSE 0 END)`, 'por_cliente')
      .addSelect(
        `SUM(CASE WHEN p.cancelado_por = 'administracion' THEN 1 ELSE 0 END)`,
        'por_administracion',
      )
      .addSelect(
        `SUM(CASE WHEN p.devolucion_pendiente = true THEN 1 ELSE 0 END)`,
        'con_devolucion_pendiente',
      )
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.estado_pedido = :estado', { estado: EstadoPedido.CANCELADO })
      .andWhere('DATE(p.fecha_cancelacion) = :fecha', { fecha });

    if (query.sede_id) {
      qb.andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id });
    }

    const raw = await qb.getRawOne();
    return {
      fecha,
      sede_id: query.sede_id ?? null,
      total_cancelaciones: Number(raw?.total ?? 0),
      por_cliente: Number(raw?.por_cliente ?? 0),
      por_administracion: Number(raw?.por_administracion ?? 0),
      con_devolucion_pendiente: Number(raw?.con_devolucion_pendiente ?? 0),
    };
  }

  validarReglaCancelacionPortal(
    pedido: Pedido,
    menuPublicado: MenuPublicado,
  ): { permitido: boolean; motivo?: string } {
    if (pedido.estado_pedido === EstadoPedido.ENTREGADO) {
      return { permitido: false, motivo: 'El pedido ya fue entregado' };
    }
    if (pedido.estado_pedido === EstadoPedido.CANCELADO) {
      return { permitido: false, motivo: 'El pedido ya está cancelado' };
    }
    if (pedido.estado_pedido === EstadoPedido.NO_RETIRADO) {
      return { permitido: false, motivo: 'El pedido ya fue cerrado como no retirado' };
    }
    if (pedido.estado_pedido === EstadoPedido.PENDIENTE_PAGO_ONLINE) {
      return { permitido: false, motivo: 'Pago en proceso, contacte a administración' };
    }
    if (pedido.estado_pedido === EstadoPedido.CONFIRMADO_PAGO_ONLINE) {
      return { permitido: false, motivo: 'Pedido con pago online, contacte a administración' };
    }
    if (!menuPublicado.fecha_hora_limite_cancelacion) {
      return { permitido: false, motivo: 'Este menú no permite cancelaciones online' };
    }
    if (new Date() > menuPublicado.fecha_hora_limite_cancelacion) {
      return { permitido: false, motivo: 'La ventana de cancelación ha expirado' };
    }
    return { permitido: true };
  }
}
