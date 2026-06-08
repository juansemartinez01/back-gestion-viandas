# Data Model: Integración Mercado Pago

**Feature**: 013-mercado-pago-integration | **Date**: 2026-06-07

## Entidad: MercadoPagoWebhookLog

**Tabla**: `mercado_pago_webhook_logs`

**Propósito**: Registro inmutable de cada notificación recibida de Mercado Pago. Solo el sistema escribe; los administradores leen.

### Campos

| Campo | Tipo DB | TypeORM | Nullable | Default | Descripción |
|-------|---------|---------|----------|---------|-------------|
| `id` | uuid | `@PrimaryGeneratedColumn('uuid')` | No | gen_random_uuid() | Identificador único |
| `tenant_id` | uuid | `@Column()` | No | — | Tenant al que pertenece el evento |
| `pedido_id` | uuid | `@Column({ nullable: true })` | Sí | NULL | UUID del pedido asociado (sin FK hard) |
| `tipo_evento` | varchar(100) | `@Column({ length: 100 })` | No | — | Tipo de evento MP: `payment`, `merchant_order`, etc. |
| `referencia_externa` | varchar(200) | `@Column({ length: 200, nullable: true })` | Sí | NULL | ID del pago en Mercado Pago |
| `payload` | jsonb | `@Column({ type: 'jsonb' })` | No | — | Payload completo recibido de MP |
| `resultado_procesamiento` | varchar(50) | `@Column({ length: 50, default: 'pendiente_revision' })` | No | `pendiente_revision` | Estado del procesamiento |
| `mensaje_error` | text | `@Column({ type: 'text', nullable: true })` | Sí | NULL | Mensaje de error si procesamiento falló |
| `fecha_recepcion` | timestamptz | `@Column({ type: 'timestamptz' })` | No | — | Timestamp exacto de recepción del webhook |
| `created_at` | timestamptz | `@CreateDateColumn()` | No | now() | Timestamp de inserción en DB |

### Enum: ResultadoProcesamiento

```typescript
export enum ResultadoProcesamiento {
  PROCESADO_OK = 'procesado_ok',
  PROCESADO_ERROR = 'procesado_error',
  PENDIENTE_REVISION = 'pendiente_revision',
}
```

Definido en `mercado-pago-webhook-log.entity.ts`.

### Índices

```typescript
@Index(['tenant_id', 'pedido_id'])
@Index(['tenant_id', 'resultado_procesamiento'])
```

Justificación:
- `(tenant_id, pedido_id)`: Consultas de admin filtrando logs por pedido.
- `(tenant_id, resultado_procesamiento)`: Consultas de admin filtrando por resultado; también útil para monitoreo de errores.

### Relaciones

- **Sin FK a `pedidos`**: `pedido_id` es referencial, no una relación TypeORM, para permitir registros con pedidos inválidos o inexistentes.
- **Sin `updated_at` ni `deleted_at`**: Los logs son inmutables como registro de auditoría. La actualización del `resultado_procesamiento` y `mensaje_error` ocurre en la misma transacción de creación (o en una actualización controlada del mismo ciclo de procesamiento).

### Notas de Migración

```sql
CREATE TABLE mercado_pago_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  pedido_id UUID,                          -- sin FK REFERENCES pedidos(id)
  tipo_evento VARCHAR(100) NOT NULL,
  referencia_externa VARCHAR(200),
  payload JSONB NOT NULL,
  resultado_procesamiento VARCHAR(50) NOT NULL DEFAULT 'pendiente_revision',
  mensaje_error TEXT,
  fecha_recepcion TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mp_webhook_logs_tenant_pedido ON mercado_pago_webhook_logs(tenant_id, pedido_id);
CREATE INDEX idx_mp_webhook_logs_tenant_resultado ON mercado_pago_webhook_logs(tenant_id, resultado_procesamiento);
```

Generar con:
```bash
npm run db:migration:generate -- migrations/CreateMercadoPagoWebhookLogs
```

---

## Cambios a Entidades Existentes

### PedidosService — Nuevo Método (no es cambio de entidad)

No se modifica el schema de `pedidos`. Solo se añade el método de servicio:

```typescript
// pedidos.service.ts
async confirmarPagoOnline(pedidoId: string, tenantId: string): Promise<void>
```

Transición de estado: `PENDIENTE_PAGO_ONLINE` → `CONFIRMADO_PAGO_ONLINE` (enum ya existe).

---

## DTO: QueryWebhookLogDto

```typescript
// dto/query-webhook-log.dto.ts
export class QueryWebhookLogDto {
  @IsOptional() @IsUUID() pedido_id?: string;
  @IsOptional() @IsEnum(ResultadoProcesamiento) resultado?: ResultadoProcesamiento;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
```
