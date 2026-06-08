import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { StockViandasModule } from 'src/modules/stock-viandas/stock-viandas.module';
import { OrdenProduccionVianda } from './entities/orden-produccion-vianda.entity';
import { ProduccionViandasService } from './produccion-viandas.service';
import { ProduccionViandasController } from './produccion-viandas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrdenProduccionVianda, MenuPublicado, Pedido]),
    TenancyModule,
    AuditModule,
    forwardRef(() => StockViandasModule),
  ],
  providers: [ProduccionViandasService],
  controllers: [ProduccionViandasController],
  exports: [ProduccionViandasService],
})
export class ProduccionViandasModule {}
