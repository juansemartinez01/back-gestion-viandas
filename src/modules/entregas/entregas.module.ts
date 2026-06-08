import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { PedidosModule } from 'src/modules/pedidos/pedidos.module';
import { PagosModule } from 'src/modules/pagos/pagos.module';
import { StockViandasModule } from 'src/modules/stock-viandas/stock-viandas.module';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { StockVianda } from 'src/modules/stock-viandas/entities/stock-vianda.entity';
import { Pago } from 'src/modules/pagos/entities/pago.entity';
import { EntregaPedido } from './entities/entrega-pedido.entity';
import { EntregasService } from './entregas.service';
import { EntregasController } from './entregas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EntregaPedido, Pedido, StockVianda, Pago]),
    PedidosModule,
    PagosModule,
    StockViandasModule,
    AuditModule,
    TenancyModule,
  ],
  providers: [EntregasService],
  controllers: [EntregasController],
  exports: [EntregasService],
})
export class EntregasModule {}
