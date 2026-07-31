import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ok } from 'src/common/http/api-response';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

@Controller('webhooks')
export class MercadoPagoWebhookController {
  constructor(
    private readonly webhookService: MercadoPagoWebhookService,
    private readonly tenancyService: TenancyService,
    private readonly configService: ConfigService,
  ) {}

  @Post('mercado-pago')
  @HttpCode(200)
  async recibirWebhook(
    @Body() body: Record<string, any>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query() query: Record<string, string | undefined>,
  ) {
    const tenantId =
      this.tenancyService.getTenantId() ??
      query.tenant_id ??
      query.tenant ??
      this.configService.get<string>('mercadoPago.webhookTenantId');
    const queryDataId = query['data.id'] ?? query.data_id ?? query.id;

    try {
      await this.webhookService.procesarWebhook(
        body,
        headers,
        tenantId ?? '',
        queryDataId,
      );
    } catch {
      // Garantía final: nunca propagamos errores al respondedor HTTP
    }

    return ok({ received: true });
  }
}
