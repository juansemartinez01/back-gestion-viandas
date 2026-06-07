import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { Pago } from './entities/pago.entity';
import { EstadoPago, MedioPago } from './pago.enums';

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    private readonly tenancyService: TenancyService,
  ) {}

  async findByPedidoId(pedidoId: string): Promise<Pago> {
    const tenantId = this.tenancyService.requireTenantId();
    const pago = await this.pagoRepo
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId', { pedidoId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!pago) {
      throw new AppError({
        code: ErrorCodes.PAGO_NOT_FOUND,
        message: 'No hay pago registrado para este pedido',
        status: 404,
        details: { pedidoId },
      });
    }
    return pago;
  }

  async crearPagoPresencial(
    pedidoId: string,
    importe: number,
    tenantId: string,
    qr: QueryRunner,
  ): Promise<Pago> {
    const pago = qr.manager.create(Pago, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      medio_pago: MedioPago.PRESENCIAL,
      estado: EstadoPago.PRESENCIAL_PENDIENTE,
      importe,
      referencia_externa: null,
      fecha_generacion: new Date(),
      fecha_aprobacion: null,
      fecha_registro_presencial: null,
    });
    return qr.manager.save(Pago, pago);
  }

  async crearPagoOnline(
    pedidoId: string,
    importe: number,
    tenantId: string,
    qr: QueryRunner,
  ): Promise<Pago> {
    const pago = qr.manager.create(Pago, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      medio_pago: MedioPago.MERCADO_PAGO,
      estado: EstadoPago.PENDIENTE,
      importe,
      referencia_externa: null,
      fecha_generacion: new Date(),
      fecha_aprobacion: null,
      fecha_registro_presencial: null,
    });
    return qr.manager.save(Pago, pago);
  }

  async registrarCobroPresencial(pedidoId: string): Promise<Pago> {
    const tenantId = this.tenancyService.requireTenantId();
    const pago = await this.pagoRepo
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId', { pedidoId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!pago) {
      throw new AppError({
        code: ErrorCodes.PAGO_NOT_FOUND,
        message: 'No hay pago registrado para este pedido',
        status: 404,
        details: { pedidoId },
      });
    }

    if (pago.estado !== EstadoPago.PRESENCIAL_PENDIENTE) {
      throw new AppError({
        code: ErrorCodes.PAGO_YA_COBRADO,
        message: 'El pago ya fue cobrado o no está en estado de cobro pendiente',
        status: 409,
        details: { pedidoId, estadoActual: pago.estado },
      });
    }

    pago.estado = EstadoPago.PRESENCIAL_COBRADO;
    pago.fecha_registro_presencial = new Date();
    return this.pagoRepo.save(pago);
  }

  async actualizarEstadoOnline(
    pedidoId: string,
    nuevoEstado: EstadoPago,
    referenciaExterna?: string,
  ): Promise<Pago> {
    const tenantId = this.tenancyService.requireTenantId();
    const pago = await this.pagoRepo
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId', { pedidoId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!pago) {
      throw new AppError({
        code: ErrorCodes.PAGO_NOT_FOUND,
        message: 'No hay pago registrado para este pedido',
        status: 404,
        details: { pedidoId },
      });
    }

    pago.estado = nuevoEstado;
    if (referenciaExterna !== undefined) {
      pago.referencia_externa = referenciaExterna;
    }
    if (nuevoEstado === EstadoPago.APROBADO) {
      pago.fecha_aprobacion = new Date();
    }
    return this.pagoRepo.save(pago);
  }

  async cancelarPago(pedidoId: string, tenantId: string): Promise<void> {
    const pago = await this.pagoRepo
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId', { pedidoId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!pago) return;

    pago.estado = EstadoPago.CANCELADO;
    await this.pagoRepo.save(pago);
  }
}
