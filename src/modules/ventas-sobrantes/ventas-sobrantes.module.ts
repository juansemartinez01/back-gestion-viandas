import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { StockViandasModule } from 'src/modules/stock-viandas/stock-viandas.module';
import { MenusPublicadosModule } from 'src/modules/menus-publicados/menus-publicados.module';
import { ProduccionViandasModule } from 'src/modules/produccion-viandas/produccion-viandas.module';
import { StockVianda } from 'src/modules/stock-viandas/entities/stock-vianda.entity';
import { MovimientoStockVianda } from 'src/modules/stock-viandas/entities/movimiento-stock-vianda.entity';
import { MenuPublicado } from 'src/modules/menus-publicados/entities/menu-publicado.entity';
import { OrdenProduccionVianda } from 'src/modules/produccion-viandas/entities/orden-produccion-vianda.entity';
import { CierresOperativosModule } from 'src/modules/cierres-operativos/cierres-operativos.module';
import { VentaSobrante } from './entities/venta-sobrante.entity';
import { VentasSobrantesService } from './ventas-sobrantes.service';
import { VentasSobrantesController } from './ventas-sobrantes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VentaSobrante,
      StockVianda,
      MovimientoStockVianda,
      MenuPublicado,
      OrdenProduccionVianda,
    ]),
    StockViandasModule,
    MenusPublicadosModule,
    ProduccionViandasModule,
    AuditModule,
    TenancyModule,
    CierresOperativosModule,
  ],
  providers: [VentasSobrantesService],
  controllers: [VentasSobrantesController],
  exports: [VentasSobrantesService],
})
export class VentasSobrantesModule {}
