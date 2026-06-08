import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { ProduccionViandasModule } from 'src/modules/produccion-viandas/produccion-viandas.module';
import { StockVianda } from './entities/stock-vianda.entity';
import { MovimientoStockVianda } from './entities/movimiento-stock-vianda.entity';
import { StockViandasService } from './stock-viandas.service';
import { StockViandasController } from './stock-viandas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockVianda, MovimientoStockVianda, Pedido]),
    TenancyModule,
    AuditModule,
    forwardRef(() => ProduccionViandasModule),
  ],
  providers: [StockViandasService],
  controllers: [StockViandasController],
  exports: [StockViandasService],
})
export class StockViandasModule {}
