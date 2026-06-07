export enum EstadoPedido {
  PENDIENTE_PAGO_ONLINE = 'pendiente_pago_online',
  CONFIRMADO_PAGO_ONLINE = 'confirmado_pago_online',
  CONFIRMADO_PAGO_PRESENCIAL = 'confirmado_pago_presencial',
  ENTREGADO = 'entregado',
  NO_RETIRADO = 'no_retirado',
  CANCELADO = 'cancelado',
}

export enum EstadoPagoPedido {
  PENDIENTE = 'pendiente',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
  CANCELADO = 'cancelado',
  PRESENCIAL_PENDIENTE = 'presencial_pendiente',
  PRESENCIAL_COBRADO = 'presencial_cobrado',
}

export enum MedioPagoPedido {
  MERCADO_PAGO = 'mercado_pago',
  PRESENCIAL = 'presencial',
}

export enum OrigenCancelacion {
  CLIENTE = 'cliente',
  ADMINISTRACION = 'administracion',
}
