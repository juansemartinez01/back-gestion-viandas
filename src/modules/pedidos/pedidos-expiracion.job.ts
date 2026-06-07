import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { Pedido } from './entities/pedido.entity';
import { EstadoPagoPedido, EstadoPedido, OrigenCancelacion } from './pedido.enums';

@Injectable()
export class PedidosExpiracionJob {
  constructor(
    @InjectRepository(Pedido)
    private readonly repo: Repository<Pedido>,
    private readonly logger: PinoLogger,
  ) {}

  @Cron('*/5 * * * *')
  async expirarReservas(): Promise<void> {
    const pedidosExpirados = await this.repo
      .createQueryBuilder('p')
      .where('p.estado_pedido = :estado', {
        estado: EstadoPedido.PENDIENTE_PAGO_ONLINE,
      })
      .andWhere('p.expires_at < NOW()')
      .andWhere('p.deleted_at IS NULL')
      .getMany();

    if (pedidosExpirados.length === 0) return;

    const ahora = new Date();
    for (const pedido of pedidosExpirados) {
      pedido.estado_pedido = EstadoPedido.CANCELADO;
      pedido.estado_pago = EstadoPagoPedido.CANCELADO;
      pedido.cancelado_por = OrigenCancelacion.ADMINISTRACION;
      pedido.motivo_cancelacion = 'Reserva expirada automáticamente';
      pedido.fecha_cancelacion = ahora;
    }

    await this.repo.save(pedidosExpirados);

    this.logger.info(
      { context: 'PedidosExpiracionJob', count: pedidosExpirados.length },
      'reservas_expiradas_canceladas',
    );
  }
}
