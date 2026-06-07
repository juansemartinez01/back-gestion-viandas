import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { BaseCrudTenantService } from 'src/common/crud/base-crud.service';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { ClientesService } from 'src/modules/clientes/clientes.service';
import { MenusPublicadosService } from 'src/modules/menus-publicados/menus-publicados.service';
import { EstadoMenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { Pedido } from './entities/pedido.entity';
import {
  EstadoPagoPedido,
  EstadoPedido,
  MedioPagoPedido,
  OrigenCancelacion,
} from './pedido.enums';
import { CreatePedidoPublicoDto } from './dto/create-pedido-publico.dto';
import { CreatePedidoManualDto } from './dto/create-pedido-manual.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { QueryPedidoDto } from './dto/query-pedido.dto';
import { CancelarPedidoDto } from './dto/cancelar-pedido.dto';
import { PagosService } from 'src/modules/pagos/pagos.service';

@Injectable()
export class PedidosService extends BaseCrudTenantService<Pedido> {
  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    private readonly dataSource: DataSource,
    private readonly menusPublicadosService: MenusPublicadosService,
    private readonly clientesService: ClientesService,
    private readonly pagosService: PagosService,
  ) {
    super(pedidoRepo);
  }

  private async generarCodigoPublico(
    tenantId: string,
    year: number,
    qr: QueryRunner,
  ): Promise<string> {
    const prefix = `VIA-${year}-`;
    const result = await qr.manager
      .createQueryBuilder(Pedido, 'p')
      .select('MAX(p.codigo_publico)', 'maxCodigo')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.codigo_publico LIKE :prefix', { prefix: `${prefix}%` })
      .setLock('pessimistic_write')
      .getRawOne();

    let seq = 1;
    if (result?.maxCodigo) {
      const parts = (result.maxCodigo as string).split('-');
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) seq = lastNum + 1;
    }

    return `${prefix}${String(seq).padStart(6, '0')}`;
  }

  private async _crearPedidoCore(
    dto: CreatePedidoPublicoDto | CreatePedidoManualDto,
  ): Promise<Pedido> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const menuPublicado = await this.menusPublicadosService.findOne(dto.menu_publicado_id);

      if (menuPublicado.estado !== EstadoMenuPublicado.ACTIVO) {
        throw new AppError({
          code: ErrorCodes.PEDIDO_MENU_NO_DISPONIBLE,
          message: 'El menú publicado no está disponible',
          status: 409,
          details: { menu_publicado_id: dto.menu_publicado_id, estado: menuPublicado.estado },
        });
      }

      const puntoValido = menuPublicado.puntosRetiro?.some(
        (pr) => pr.id === dto.punto_retiro_id,
      );
      if (!puntoValido) {
        throw new AppError({
          code: ErrorCodes.PEDIDO_PUNTO_RETIRO_NO_HABILITADO,
          message: 'El punto de retiro no está habilitado para este menú',
          status: 422,
          details: { punto_retiro_id: dto.punto_retiro_id },
        });
      }

      if (menuPublicado.limite_maximo_viandas !== null) {
        const countResult = await qr.manager
          .createQueryBuilder(Pedido, 'p')
          .select('COALESCE(SUM(p.cantidad), 0)', 'total')
          .where('p.tenant_id = :tenantId', { tenantId })
          .andWhere('p.menu_publicado_id = :mpId', { mpId: menuPublicado.id })
          .andWhere('p.fecha_retiro = :fecha', { fecha: menuPublicado.fecha_venta })
          .andWhere('p.estado_pedido IN (:...estados)', {
            estados: [
              EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL,
              EstadoPedido.CONFIRMADO_PAGO_ONLINE,
              EstadoPedido.PENDIENTE_PAGO_ONLINE,
            ],
          })
          .andWhere('p.deleted_at IS NULL')
          .setLock('pessimistic_write')
          .getRawOne();

        const totalActual = parseInt(countResult?.total ?? '0', 10);
        if (totalActual + dto.cantidad > menuPublicado.limite_maximo_viandas) {
          throw new AppError({
            code: ErrorCodes.PEDIDO_CAPACIDAD_AGOTADA,
            message: 'Se alcanzó la capacidad máxima de viandas para este menú',
            status: 409,
            details: {
              limite: menuPublicado.limite_maximo_viandas,
              ocupado: totalActual,
              solicitado: dto.cantidad,
            },
          });
        }
      }

      const precioUnitario = Number(menuPublicado.precio_encargo);
      const importeTotal = precioUnitario * dto.cantidad;

      const cliente = await this.clientesService.upsertByDni({
        dni: dto.dni,
        nombre: dto.nombre,
        apellido: dto.apellido,
        telefono: dto.telefono,
        email: dto.email,
      });

      const codigoPublico = await this.generarCodigoPublico(
        tenantId,
        new Date().getFullYear(),
        qr,
      );

      const now = new Date();
      const hoy = now.toISOString().slice(0, 10);

      let estadoPedido: EstadoPedido;
      let estadoPago: EstadoPagoPedido;
      let expiresAt: Date | null;
      let fechaConfirmacion: Date | null;

      if (dto.medio_pago === MedioPagoPedido.PRESENCIAL) {
        estadoPedido = EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL;
        estadoPago = EstadoPagoPedido.PRESENCIAL_PENDIENTE;
        expiresAt = null;
        fechaConfirmacion = now;
      } else {
        estadoPedido = EstadoPedido.PENDIENTE_PAGO_ONLINE;
        estadoPago = EstadoPagoPedido.PENDIENTE;
        expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
        fechaConfirmacion = null;
      }

      const pedido = qr.manager.create(Pedido, {
        tenant_id: tenantId,
        codigo_publico: codigoPublico,
        cliente_id: cliente.id,
        menu_publicado_id: menuPublicado.id,
        sede_id: menuPublicado.sede_id,
        punto_retiro_id: dto.punto_retiro_id,
        dni_informado: dto.dni,
        nombre_informado: dto.nombre,
        apellido_informado: dto.apellido,
        telefono_informado: dto.telefono ?? null,
        email_informado: dto.email ?? null,
        fecha_pedido: hoy,
        fecha_retiro: menuPublicado.fecha_venta,
        cantidad: dto.cantidad,
        precio_unitario: precioUnitario,
        importe_total: importeTotal,
        medio_pago: dto.medio_pago,
        estado_pedido: estadoPedido,
        estado_pago: estadoPago,
        expires_at: expiresAt,
        fecha_confirmacion: fechaConfirmacion,
        fecha_cancelacion: null,
        cancelado_por: null,
        usuario_cancelacion_id: null,
        motivo_cancelacion: null,
        devolucion_pendiente: false,
      });

      const saved = await qr.manager.save(Pedido, pedido);

      if (dto.medio_pago === MedioPagoPedido.PRESENCIAL) {
        await this.pagosService.crearPagoPresencial(saved.id, saved.importe_total, tenantId, qr);
      } else {
        await this.pagosService.crearPagoOnline(saved.id, saved.importe_total, tenantId, qr);
      }

      await qr.commitTransaction();
      return saved;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async crearPedidoPublico(dto: CreatePedidoPublicoDto): Promise<Pedido> {
    return this._crearPedidoCore(dto);
  }

  async crearPedidoManual(
    dto: CreatePedidoManualDto,
    _usuarioId: string,
  ): Promise<Pedido> {
    if (dto.medio_pago !== MedioPagoPedido.PRESENCIAL) {
      throw new AppError({
        code: ErrorCodes.PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL,
        message: 'Los pedidos manuales solo admiten pago presencial',
        status: 422,
        details: { medio_pago: dto.medio_pago },
      });
    }
    return this._crearPedidoCore(dto);
  }

  async consultarPorDni(dni: string): Promise<Pedido[]> {
    const tenantId = this.getTenantId({ strictTenant: true });
    return this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.dni_informado ILIKE :dni', { dni })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC')
      .take(50)
      .getMany();
  }

  async findOne(id: string): Promise<Pedido> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const pedido = await this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL')
      .leftJoinAndSelect('p.menuPublicado', 'mp')
      .leftJoinAndSelect('p.sede', 'sede')
      .leftJoinAndSelect('p.puntoRetiro', 'pr')
      .getOne();

    if (!pedido) {
      throw new AppError({
        code: ErrorCodes.PEDIDO_NOT_FOUND,
        message: 'Pedido no encontrado',
        status: 404,
        details: { id },
      });
    }
    return pedido;
  }

  async list(query: QueryPedidoDto): Promise<{
    items: Pedido[];
    total: number;
    page: number;
    limit: number;
  }> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.pedidoRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.deleted_at IS NULL');

    if (query.fecha_retiro) {
      qb.andWhere('p.fecha_retiro = :fechaRetiro', { fechaRetiro: query.fecha_retiro });
    }
    if (query.sede_id) {
      qb.andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id });
    }
    if (query.punto_retiro_id) {
      qb.andWhere('p.punto_retiro_id = :puntoRetiroId', {
        puntoRetiroId: query.punto_retiro_id,
      });
    }
    if (query.estado_pedido) {
      qb.andWhere('p.estado_pedido = :estadoPedido', {
        estadoPedido: query.estado_pedido,
      });
    }
    if (query.estado_pago) {
      qb.andWhere('p.estado_pago = :estadoPago', { estadoPago: query.estado_pago });
    }
    if (query.menu_publicado_id) {
      qb.andWhere('p.menu_publicado_id = :mpId', { mpId: query.menu_publicado_id });
    }
    if (query.dni) {
      qb.andWhere('p.dni_informado ILIKE :dni', { dni: `%${query.dni}%` });
    }

    qb.orderBy('p.created_at', 'DESC');

    const currentPage = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: currentPage, limit };
  }

  async cancelarDesdePortal(
    id: string,
    dto?: CancelarPedidoDto,
  ): Promise<Pedido> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;
    const pedido = await this.findOne(id);

    const estadosTerminales = [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO];
    if (estadosTerminales.includes(pedido.estado_pedido)) {
      throw new AppError({
        code: ErrorCodes.PEDIDO_NO_CANCELABLE,
        message: 'El pedido no puede cancelarse en su estado actual',
        status: 409,
        details: { estado_pedido: pedido.estado_pedido },
      });
    }

    if (
      pedido.estado_pedido === EstadoPedido.PENDIENTE_PAGO_ONLINE &&
      pedido.expires_at !== null &&
      pedido.expires_at < new Date()
    ) {
      throw new AppError({
        code: ErrorCodes.PEDIDO_RESERVA_EXPIRADA,
        message: 'La reserva online ha expirado',
        status: 409,
        details: { expires_at: pedido.expires_at },
      });
    }

    if (
      pedido.menuPublicado?.fecha_hora_limite_cancelacion &&
      pedido.menuPublicado.fecha_hora_limite_cancelacion < new Date()
    ) {
      throw new AppError({
        code: ErrorCodes.PEDIDO_FUERA_DE_VENTANA_CANCELACION,
        message: 'La ventana de cancelación para este menú ha expirado',
        status: 409,
        details: {
          fecha_hora_limite_cancelacion:
            pedido.menuPublicado.fecha_hora_limite_cancelacion,
        },
      });
    }

    if (pedido.estado_pago === EstadoPagoPedido.APROBADO) {
      pedido.devolucion_pendiente = true;
    }

    pedido.estado_pedido = EstadoPedido.CANCELADO;
    pedido.cancelado_por = OrigenCancelacion.CLIENTE;
    pedido.fecha_cancelacion = new Date();
    pedido.estado_pago = EstadoPagoPedido.CANCELADO;
    pedido.motivo_cancelacion = dto?.motivo ?? null;

    const saved = await this.pedidoRepo.save(pedido);
    await this.pagosService.cancelarPago(saved.id, tenantId);
    return saved;
  }

  async cancelarDesdeAdmin(
    id: string,
    dto: CancelarPedidoDto,
    usuarioId: string,
  ): Promise<Pedido> {
    const tenantId = this.getTenantId({ strictTenant: true }) as string;
    const pedido = await this.findOne(id);

    const estadosTerminales = [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO];
    if (estadosTerminales.includes(pedido.estado_pedido)) {
      throw new AppError({
        code: ErrorCodes.PEDIDO_NO_CANCELABLE,
        message: 'El pedido no puede cancelarse en su estado actual',
        status: 409,
        details: { estado_pedido: pedido.estado_pedido },
      });
    }

    const estadoPagoAnterior = pedido.estado_pago;

    pedido.estado_pedido = EstadoPedido.CANCELADO;
    pedido.cancelado_por = OrigenCancelacion.ADMINISTRACION;
    pedido.usuario_cancelacion_id = usuarioId;
    pedido.fecha_cancelacion = new Date();
    pedido.motivo_cancelacion = dto.motivo ?? null;
    pedido.estado_pago = EstadoPagoPedido.CANCELADO;

    if (estadoPagoAnterior === EstadoPagoPedido.APROBADO) {
      pedido.devolucion_pendiente = true;
    }

    const saved = await this.pedidoRepo.save(pedido);
    await this.pagosService.cancelarPago(saved.id, tenantId);
    return saved;
  }

  async updatePedido(id: string, dto: UpdatePedidoDto): Promise<Pedido> {
    const pedido = await this.findOne(id);

    if (dto.telefono_informado !== undefined) {
      pedido.telefono_informado = dto.telefono_informado;
    }
    if (dto.email_informado !== undefined) {
      pedido.email_informado = dto.email_informado;
    }
    if (dto.motivo !== undefined) {
      pedido.motivo_cancelacion = dto.motivo;
    }

    await this.pedidoRepo.save(pedido);
    return this.findOne(id);
  }
}
