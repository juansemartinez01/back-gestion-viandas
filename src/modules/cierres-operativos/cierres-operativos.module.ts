import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { EntregaPedido } from 'src/modules/entregas/entities/entrega-pedido.entity';
import { VentaSobrante } from 'src/modules/ventas-sobrantes/entities/venta-sobrante.entity';
import { CierreOperativo } from './entities/cierre-operativo.entity';
import { CierresOperativosService } from './cierres-operativos.service';
import { CierresOperativosController } from './cierres-operativos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CierreOperativo, Pedido, EntregaPedido, VentaSobrante]),
    AuditModule,
    TenancyModule,
  ],
  providers: [CierresOperativosService],
  controllers: [CierresOperativosController],
  exports: [CierresOperativosService],
})
export class CierresOperativosModule {}
