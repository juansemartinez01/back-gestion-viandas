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
      signature.split(',').map((p) => {
        const [key, value] = p.split('=');
        return [key?.trim(), value?.trim()] as [string, string];
      }),
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];

    if (!dataId || !requestId || !ts || !v1) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_FIRMA_INVALIDA,
        message: 'Formato de firma inválido',
        status: 401,
      });
    }

    const manifest = [
      `id:${dataId}`,
      `request-id:${requestId}`,
      `ts:${ts}`,
    ]
      .filter(Boolean)
      .join(';')
      .concat(';');

    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(v1, 'hex');
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_FIRMA_INVALIDA,
        message: 'Firma de webhook inválida',
        status: 401,
      });
    }
  }

  private extractDataId(payload: Record<string, any>, queryDataId?: string): string | undefined {
    const resource = typeof payload.resource === 'string' ? payload.resource : '';
    const resourceId = /^\d+$/.test(resource)
      ? resource
      : resource.match(/\/(\d+)(?:\?.*)?$/)?.[1];
    return (
      queryDataId?.toString() ??
      payload.data?.id?.toString() ??
      payload.id?.toString() ??
      resourceId
    );
  }

  private extractTipoEvento(payload: Record<string, any>): string {
    return payload.type ?? payload.topic ?? payload.action ?? 'desconocido';
  }

  async procesarWebhook(
    payload: Record<string, any>,
    headers: Record<string, string | string[] | undefined>,
    tenantId: string,
    queryDataId?: string,
  ): Promise<void> {
    const xSignature = headers['x-signature'] as string | undefined;
    const xRequestId = headers['x-request-id'] as string | undefined;

    const tipoEvento = this.extractTipoEvento(payload);
    const dataId = this.extractDataId(payload, queryDataId);

    try {
      this.validarFirmaHmac(dataId ?? '', xRequestId, xSignature);
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

    if (!dataId) return;

    try {
      if (tipoEvento === 'payment') {
        const paymentData = await this.fetchPayment(dataId);
        if (paymentData.status === 'approved') {
          await this.procesarPagoAprobado(dataId, paymentData, tenantId, log.id);
        } else if (paymentData.status === 'rejected' || paymentData.status === 'cancelled') {
          await this.procesarPagoRechazado(paymentData, tenantId, log.id);
        }
      } else if (tipoEvento === 'merchant_order') {
        await this.procesarMerchantOrder(payload, dataId, tenantId, log.id);
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

  private async fetchMerchantOrder(
    payload: Record<string, any>,
    merchantOrderId: string,
  ): Promise<Record<string, any>> {
    const accessToken = this.configService.get<string>('mercadoPago.accessToken');
    if (!accessToken) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_ERROR_PREFERENCIA,
        message: 'MP_ACCESS_TOKEN no configurado',
        status: 502,
      });
    }

    const resource =
      typeof payload.resource === 'string' &&
      payload.resource.startsWith('https://api.mercadolibre.com/merchant_orders/')
        ? payload.resource
        : `https://api.mercadolibre.com/merchant_orders/${merchantOrderId}`;

    let response: Response;
    try {
      response = await fetch(resource, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err: any) {
      throw new Error(`Error consultando merchant order en MP: ${err?.message}`);
    }

    if (!response.ok) {
      throw new Error(
        `MP devolvió HTTP ${response.status} al consultar merchant order ${merchantOrderId}`,
      );
    }

    return response.json() as Promise<Record<string, any>>;
  }

  private async procesarMerchantOrder(
    payload: Record<string, any>,
    merchantOrderId: string,
    tenantId: string,
    logId: string,
  ): Promise<void> {
    const merchantOrder = await this.fetchMerchantOrder(payload, merchantOrderId);
    const payments = Array.isArray(merchantOrder.payments)
      ? merchantOrder.payments
      : [];

    const approved = payments.find((p) => p.status === 'approved');
    if (approved?.id) {
      await this.procesarPagoAprobado(
        approved.id.toString(),
        {
          ...approved,
          external_reference: merchantOrder.external_reference,
        },
        tenantId,
        logId,
      );
      return;
    }

    const rejected = payments.find(
      (p) => p.status === 'rejected' || p.status === 'cancelled',
    );
    if (rejected?.id) {
      await this.procesarPagoRechazado(
        {
          ...rejected,
          external_reference: merchantOrder.external_reference,
        },
        tenantId,
        logId,
      );
      return;
    }

    await this.logRepo.update(logId, {
      pedido_id: merchantOrder.external_reference ?? null,
      resultado_procesamiento: ResultadoProcesamiento.PENDIENTE_REVISION,
      mensaje_error: null,
    });
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

    await this.pagosService.actualizarEstadoOnline(
      pedidoId,
      EstadoPago.APROBADO,
      paymentId,
      tenantId,
    );
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

    await this.pagosService.actualizarEstadoOnline(
      pedidoId,
      EstadoPago.RECHAZADO,
      undefined,
      tenantId,
    );
    await this.pedidosService.rechazarPagoOnline(pedidoId, tenantId);
    await this.logRepo.update(logId, {
      pedido_id: pedidoId,
      resultado_procesamiento: ResultadoProcesamiento.PROCESADO_OK,
    });
  }
}
