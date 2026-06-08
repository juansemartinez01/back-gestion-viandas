import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ok } from 'src/common/http/api-response';
import { TenancyService } from 'src/modules/tenancy/tenancy.service';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';

@Controller('webhooks')
export class MercadoPagoWebhookController {
  constructor(
    private readonly webhookService: MercadoPagoWebhookService,
    private readonly tenancyService: TenancyService,
  ) {}

  @Post('mercado-pago')
  @HttpCode(200)
  async recibirWebhook(
    @Body() body: Record<string, any>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    let tenantId: string;
    try {
      tenantId = this.tenancyService.requireTenantId();
    } catch {
      tenantId = 'unknown';
    }

    try {
      await this.webhookService.procesarWebhook(body, headers, tenantId);
    } catch {
      // Garantía final: nunca propagamos errores al respondedor HTTP
    }

    return ok({ received: true });
  }
}
