import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';

export interface PreferenciaResult {
  preference_id: string;
  init_point: string;
}

@Injectable()
export class MercadoPagoService {
  constructor(private readonly configService: ConfigService) {}

  async generarPreferencia(
    pedidoId: string,
    importe: number,
    descripcion: string,
  ): Promise<PreferenciaResult> {
    const accessToken = this.configService.get<string>('mercadoPago.accessToken');
    const successUrl = this.configService.get<string>('mercadoPago.successUrl');
    const failureUrl = this.configService.get<string>('mercadoPago.failureUrl');
    const pendingUrl = this.configService.get<string>('mercadoPago.pendingUrl');

    if (!accessToken) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_ERROR_PREFERENCIA,
        message: 'Mercado Pago no está configurado (MP_ACCESS_TOKEN ausente)',
        status: 502,
      });
    }

    const isPublicUrl = (url: string | null | undefined) =>
      !!url && url.startsWith('https://');

    const body: Record<string, unknown> = {
      items: [
        {
          id: pedidoId,
          title: descripcion,
          quantity: 1,
          unit_price: importe,
          currency_id: 'ARS',
        },
      ],
      external_reference: pedidoId,
      back_urls: {
        success: successUrl ?? '',
        failure: failureUrl ?? '',
        pending: pendingUrl ?? '',
      },
    };

    // auto_return requiere una back_url.success pública (HTTPS). Se omite en desarrollo.
    if (isPublicUrl(successUrl)) {
      body.auto_return = 'approved';
    }

    let response: Response;
    try {
      response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_ERROR_PREFERENCIA,
        message: `Error de conexión con Mercado Pago: ${err?.message ?? 'desconocido'}`,
        status: 502,
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AppError({
        code: ErrorCodes.MERCADO_PAGO_ERROR_PREFERENCIA,
        message: `Mercado Pago rechazó la preferencia: HTTP ${response.status}`,
        status: 502,
        details: { mpResponse: text },
      });
    }

    const data = (await response.json()) as { id: string; init_point: string };
    return { preference_id: data.id, init_point: data.init_point };
  }
}
