# Research: Pagos

**Feature**: 012-pagos | **Date**: 2026-06-07

## Decisions

### D-001: PagosService sin BaseCrudTenantService

- **Decision**: `PagosService` NO extiende `BaseCrudTenantService<Pago>`.
- **Rationale**: `BaseCrudTenantService` asume operaciones CRUD genéricas. `PagosService` tiene un API completamente distinto (métodos semánticos: `crearPagoPresencial`, `cancelarPago`, etc.) y es consumido exclusivamente por otros servicios, no directamente por controllers con `PageQueryDto`. Extenderlo añadiría métodos que no deben exponerse y complicaría el uso.
- **Alternatives considered**: Extender `BaseCrudTenantService` y solo usar métodos propios — rechazado porque hereda métodos `list`, `create`, `update`, `remove` que no deben existir en este servicio.
- **How to apply**: `PagosService` usa `@InjectRepository(Pago)` y `tenantContext` directamente. Todas las queries incluyen `WHERE tenant_id = :tenantId` explícitamente.

### D-002: Entidad sin BaseEntity del proyecto

- **Decision**: `Pago` NO extiende `BaseEntity` del proyecto (`src/common/entities/base.entity.ts`) porque ese base incluye `@DeleteDateColumn() deleted_at`. Los pagos no se eliminan — ni siquiera soft delete.
- **Rationale**: Agregar `deleted_at` crea confusión (¿se puede borrar un pago?), exige filtros `WHERE deleted_at IS NULL` innecesarios y viola la semántica del módulo.
- **Alternatives considered**: Extender BaseEntity e ignorar `deleted_at` — rechazado por la confusión semántica y el overhead de columna innecesaria.
- **How to apply**: `Pago` define directamente `@PrimaryGeneratedColumn('uuid') id`, `@Column() tenant_id`, `@CreateDateColumn() created_at`, `@UpdateDateColumn() updated_at`.

### D-003: Tenancy sin strictTenant para métodos internos

- **Decision**: Los métodos internos (`crearPagoPresencial`, `crearPagoOnline`, `cancelarPago`, etc.) reciben `tenantId` como parámetro explícito en lugar de leerlo del `tenantContext`.
- **Rationale**: Los métodos internos se llaman desde `PedidosService` que ya tiene el `tenantId` resuelto. Pasar el tenantId explícitamente hace el contrato de la función claro y evita dependencias implícitas en el AsyncLocalStorage. El único método que lee del contexto es `findByPedidoId` (llamado desde el controller).
- **Alternatives considered**: Leer siempre de `tenantContext` — rechazado porque `crearPagoPresencial` se llama dentro de una transacción de `PedidosService` donde el contexto ya fue validado; pasar el tenantId es más explícito y testeable.
- **How to apply**: Métodos internos: `crearPagoPresencial(pedidoId: string, importe: number, tenantId: string)`. Método del controller: `findByPedidoId` lee tenant del contexto con `getTenantIdFromContext()`.

### D-004: Integración con PedidosService dentro de transacción

- **Decision**: `crearPagoPresencial` / `crearPagoOnline` son llamados DENTRO del `QueryRunner` de `_crearPedidoCore`. El `PagosService` recibe el `QueryRunner` como parámetro para persistir el `Pago` dentro de la misma transacción.
- **Rationale**: Si el pago falla, el pedido también debe revertirse (SC-001 requiere atomicidad). La única forma de garantizarlo es usar el mismo `QueryRunner`.
- **Alternatives considered**: Crear el pago después de `commitTransaction()` — rechazado porque viola la atomicidad (SC-004 en spec: "la creación del pedido también se revierte").
- **How to apply**: Firmas: `crearPagoPresencial(pedidoId: string, importe: number, tenantId: string, qr: QueryRunner): Promise<Pago>`. Usar `qr.manager.save(Pago, pago)` en lugar de `this.pagoRepo.save()`.

### D-005: Actualización de estado idempotente en actualizarEstadoOnline

- **Decision**: Si llega una segunda actualización con la misma `referencia_externa`, se actualiza el estado sin error (idempotente).
- **Rationale**: SC-005 exige idempotencia explícita. Los webhooks de MP pueden dispararse más de una vez.
- **Alternatives considered**: Lanzar `PAGO_YA_EXISTE` si la referencia ya existe — rechazado por la idempotencia requerida.
- **How to apply**: En `actualizarEstadoOnline`: buscar el pago, actualizar `estado` y `referencia_externa` siempre (no verificar si la referencia ya existe). Solo lanzar error si el pago no existe (`PAGO_NOT_FOUND`).

### D-006: cancelarPago no lanza error si pago no existe

- **Decision**: `cancelarPago(pedidoId, tenantId)` es tolerante a la ausencia del pago — si no encuentra pago, simplemente retorna sin error.
- **Rationale**: Puede ocurrir que un pedido se cancele antes de que se registre el pago (race condition extrema). El módulo de pedidos es el fuente de verdad sobre la cancelación.
- **Alternatives considered**: Lanzar `PAGO_NOT_FOUND` — rechazado para evitar que la cancelación del pedido falle por un pago que no existe.
- **How to apply**: `cancelarPago`: `findByPedidoId` retorna `null` → retornar sin error. Si existe → actualizar estado a `cancelado` → save.
