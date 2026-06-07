# Data Model: Pagos

**Feature**: 012-pagos | **Date**: 2026-06-07

## Entity: Pago

**Table**: `pagos`

**Nota**: NO extiende `BaseEntity` del proyecto (evita `deleted_at`). Define columnas directamente.

```typescript
// src/modules/pagos/entities/pago.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoPago, MedioPago } from '../pago.enums';
import { Pedido } from 'src/modules/pedidos/entities/pedido.entity';

@Entity('pagos')
@Index(['tenant_id', 'pedido_id'])
export class Pago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid', unique: true })
  pedido_id: string;

  @ManyToOne(() => Pedido, { nullable: false })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column({ type: 'enum', enum: MedioPago })
  medio_pago: MedioPago;

  @Column({ type: 'enum', enum: EstadoPago })
  estado: EstadoPago;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  importe: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  referencia_externa: string | null;

  @Column({ type: 'timestamptz' })
  fecha_generacion: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_aprobacion: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_registro_presencial: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
```

## Enums

```typescript
// src/modules/pagos/pago.enums.ts

export enum EstadoPago {
  PENDIENTE = 'pendiente',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
  CANCELADO = 'cancelado',
  PRESENCIAL_PENDIENTE = 'presencial_pendiente',
  PRESENCIAL_COBRADO = 'presencial_cobrado',
}

export enum MedioPago {
  MERCADO_PAGO = 'mercado_pago',
  PRESENCIAL = 'presencial',
}
```

## Service Signatures

```typescript
// src/modules/pagos/pagos.service.ts

class PagosService {
  // Consulta (usada por el controller — lee tenantId del contexto)
  findByPedidoId(pedidoId: string): Promise<Pago | null>

  // Llamado desde PedidosService dentro del QueryRunner de la transacción
  crearPagoPresencial(pedidoId: string, importe: number, tenantId: string, qr: QueryRunner): Promise<Pago>
  crearPagoOnline(pedidoId: string, importe: number, tenantId: string, qr: QueryRunner): Promise<Pago>

  // Llamado desde EntregasService (Stage 5)
  registrarCobroPresencial(pedidoId: string): Promise<Pago>

  // Llamado desde MercadoPagoService (Stage 4)
  actualizarEstadoOnline(pedidoId: string, nuevoEstado: EstadoPago, referenciaExterna?: string): Promise<Pago>

  // Llamado desde PedidosService al cancelar pedido
  cancelarPago(pedidoId: string, tenantId: string): Promise<void>
}
```

## Error Codes

```typescript
// En src/common/errors/error-codes.ts — agregar:
PAGO_NOT_FOUND: 'PAGO_NOT_FOUND',   // 404 — pago no encontrado para ese pedido_id
PAGO_YA_COBRADO: 'PAGO_YA_COBRADO', // 409 — intento de cobro presencial sobre pago ya cobrado
PAGO_YA_EXISTE: 'PAGO_YA_EXISTE',   // 409 — intento de crear segundo pago para mismo pedido
```

## State Transitions

```
PENDIENTE (online)
  ├─→ APROBADO        (actualizarEstadoOnline con estado=aprobado)
  ├─→ RECHAZADO       (actualizarEstadoOnline con estado=rechazado)
  └─→ CANCELADO       (cancelarPago)

PRESENCIAL_PENDIENTE
  ├─→ PRESENCIAL_COBRADO  (registrarCobroPresencial)
  └─→ CANCELADO           (cancelarPago)

APROBADO
  └─→ CANCELADO       (cancelarPago — devolucion_pendiente=true en pedido)

RECHAZADO → terminal (sin transición)
CANCELADO → terminal (sin transición)
PRESENCIAL_COBRADO → terminal (sin transición)
```

## DB Constraints

- `UNIQUE(pedido_id)` — un pedido tiene máximo un pago
- `FK pedido_id → pedidos(id) ON DELETE RESTRICT` — no se puede eliminar un pedido con pago
- `INDEX(tenant_id, pedido_id)` — lookup eficiente por tenant + pedido
- Sin `deleted_at` — pagos no se eliminan
