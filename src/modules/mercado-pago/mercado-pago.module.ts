import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosModule } from 'src/modules/pedidos/pedidos.module';
import { PagosModule } from 'src/modules/pagos/pagos.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { MercadoPagoWebhookLog } from './entities/mercado-pago-webhook-log.entity';
import { MercadoPagoService } from './mercado-pago.service';
import { MercadoPagoWebhookService } from './mercado-pago-webhook.service';
import { MercadoPagoController } from './mercado-pago.controller';
import { MercadoPagoWebhookController } from './mercado-pago-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MercadoPagoWebhookLog]),
    forwardRef(() => PedidosModule),
    PagosModule,
    TenancyModule,
  ],
  providers: [MercadoPagoService, MercadoPagoWebhookService],
  controllers: [MercadoPagoController, MercadoPagoWebhookController],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
