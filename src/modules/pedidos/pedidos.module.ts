import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientesModule } from 'src/modules/clientes/clientes.module';
import { MenusPublicadosModule } from 'src/modules/menus-publicados/menus-publicados.module';
import { SedesModule } from 'src/modules/sedes/sedes.module';
import { PuntosRetiroModule } from 'src/modules/puntos-retiro/puntos-retiro.module';
import { AuditModule } from 'src/modules/audit/audit.module';
import { PagosModule } from 'src/modules/pagos/pagos.module';
import { MercadoPagoModule } from 'src/modules/mercado-pago/mercado-pago.module';
import { Pedido } from './entities/pedido.entity';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { PublicPedidosController } from './public-pedidos.controller';
import { PedidosExpiracionJob } from './pedidos-expiracion.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido]),
    ClientesModule,
    MenusPublicadosModule,
    SedesModule,
    PuntosRetiroModule,
    AuditModule,
    PagosModule,
    forwardRef(() => MercadoPagoModule),
  ],
  providers: [PedidosService, PedidosExpiracionJob],
  controllers: [PedidosController, PublicPedidosController],
  exports: [PedidosService],
})
export class PedidosModule {}
