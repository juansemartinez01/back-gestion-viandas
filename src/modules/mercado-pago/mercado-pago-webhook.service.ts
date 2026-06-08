import * as crypto from 'crypto';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { PagosService } from 'src/modules/pagos/pagos.service';
import { PedidosService } from 'src/modules/pedidos/pedidos.service';
import { EstadoPago } from 'src/modules/pagos/pago.enums';
import {
  MercadoPagoWebhookLog,
  ResultadoProcesamiento,
} from './entities/mercado-pago-webhook-log.entity';

@Injectable()
export class MercadoPagoWebhookService {
  constructor(
    @InjectRepository(MercadoPagoWebhookLog)
    private readonly logRepo: Repository<MercadoPagoWebhookLog>,
    private readonly configService: ConfigService,
    private readonly pagosService: PagosService,
    @Inject(forwardRef(() => PedidosService))
    private readonly pedidosService: PedidosService,
  ) {}

  private validarFirmaHmac(
    dataId: string,
    requestId: string | undefined,
    ts: string,
    signature: string | undefined,
  ): void {
    const secret = this.configService.get<string>('mercadoPago.webhookSecret');
    if (!secret) return;

    if (!signature) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_FIRMA_INVALIDA,
        message: 'Firma de webhook ausente',
        status: 401,
      });
    }

    const parts = Object.fromEntries(
      signature.split(',').map((p) => p.split('=') as [string, string]),
    );
    const v1 = parts['v1'];

    if (!v1 || !ts) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_FIRMA_INVALIDA,
        message: 'Formato de firma inválido',
        status: 401,
      });
    }

    const manifest = [
      `id:${dataId}`,
      requestId ? `request-id:${requestId}` : null,
      `ts:${ts}`,
    ]
      .filter(Boolean)
      .join(';');

    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    if (expected !== v1) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_FIRMA_INVALIDA,
        message: 'Firma de webhook inválida',
        status: 401,
      });
    }
  }

  async procesarWebhook(
    payload: Record<string, any>,
    headers: Record<string, string | string[] | undefined>,
    tenantId: string,
  ): Promise<void> {
    const xSignature = headers['x-signature'] as string | undefined;
    const xRequestId = headers['x-request-id'] as string | undefined;
    const xTimestamp = headers['x-timestamp'] as string | undefined;

    const tipoEvento: string = payload.type ?? payload.action ?? 'desconocido';
    const dataId: string | undefined = payload.data?.id?.toString();

    try {
      this.validarFirmaHmac(
        dataId ?? '',
        xRequestId,
        xTimestamp ?? '',
        xSignature,
      );
    } catch (err: any) {
      const log = this.logRepo.create({
        tenant_id: tenantId,
        tipo_evento: tipoEvento,
        referencia_externa: dataId ?? null,
        payload,
        resultado_procesamiento: ResultadoProcesamiento.PROCESADO_ERROR,
        mensaje_error: err?.message ?? 'Firma inválida',
        fecha_recepcion: new Date(),
      });
      await this.logRepo.save(log);
      return;
    }

    const log = await this.logRepo.save(
      this.logRepo.create({
        tenant_id: tenantId,
        tipo_evento: tipoEvento,
        referencia_externa: dataId ?? null,
        payload,
        resultado_procesamiento: ResultadoProcesamiento.PENDIENTE_REVISION,
        mensaje_error: null,
        fecha_recepcion: new Date(),
      }),
    );

    if (tipoEvento !== 'payment' || !dataId) return;

    try {
      const paymentData = await this.fetchPayment(dataId);
      if (paymentData.status === 'approved') {
        await this.procesarPagoAprobado(dataId, paymentData, tenantId, log.id);
      } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
        await this.procesarPagoRechazado(paymentData, tenantId, log.id);
      }
    } catch (err: any) {
      await this.logRepo.update(log.id, {
        resultado_procesamiento: ResultadoProcesamiento.PROCESADO_ERROR,
        mensaje_error: err?.message ?? 'Error desconocido',
      });
    }
  }

  private async fetchPayment(paymentId: string): Promise<Record<string, any>> {
    const accessToken = this.configService.get<string>('mercadoPago.accessToken');
    if (!accessToken) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_ERROR_PREFERENCIA,
        message: 'MP_ACCESS_TOKEN no configurado',
        status: 502,
      });
    }

    let response: Response;
    try {
      response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err: any) {
      throw new Error(`Error consultando pago en MP: ${err?.message}`);
    }

    if (!response.ok) {
      throw new Error(`MP devolvió HTTP ${response.status} al consultar pago ${paymentId}`);
    }

    return response.json() as Promise<Record<string, any>>;
  }

  private async procesarPagoAprobado(
    paymentId: string,
    paymentData: Record<string, any>,
    tenantId: string,
    logId: string,
  ): Promise<void> {
    const pedidoId: string | undefined = paymentData.external_reference;
    if (!pedidoId) {
      throw new Error('Pago aprobado sin external_reference — no se puede identificar el pedido');
    }

    await this.pagosService.actualizarEstadoOnline(pedidoId, EstadoPago.APROBADO, paymentId);
    await this.pedidosService.confirmarPagoOnline(pedidoId, tenantId);
    await this.logRepo.update(logId, {
      pedido_id: pedidoId,
      resultado_procesamiento: ResultadoProcesamiento.PROCESADO_OK,
    });
  }

  private async procesarPagoRechazado(
    paymentData: Record<string, any>,
    tenantId: string,
    logId: string,
  ): Promise<void> {
    const pedidoId: string | undefined = paymentData.external_reference;
    if (!pedidoId) {
      throw new Error('Pago rechazado sin external_reference — no se puede identificar el pedido');
    }

    await this.pagosService.actualizarEstadoOnline(pedidoId, EstadoPago.RECHAZADO);
    await this.logRepo.update(logId, {
      pedido_id: pedidoId,
      resultado_procesamiento: ResultadoProcesamiento.PROCESADO_OK,
    });
  }
}
