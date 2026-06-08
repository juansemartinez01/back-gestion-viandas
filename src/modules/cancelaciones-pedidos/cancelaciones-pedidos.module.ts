import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';
import { TenancyModule } from 'src/modules/tenancy/tenancy.module';
import { CancelacionesPedidosService } from './cancelaciones-pedidos.service';
import { CancelacionesPedidosController } from './cancelaciones-pedidos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido]), TenancyModule],
  providers: [CancelacionesPedidosService],
  controllers: [CancelacionesPedidosController],
  exports: [CancelacionesPedidosService],
})
export class CancelacionesPedidosModule {}
