# Implementation Plan: Pagos (Registro y Gestión de Pagos de Pedidos)

**Branch**: `012-pagos` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Módulo de soporte para registro y gestión de pagos asociados a pedidos de viandas. Provee la entidad `Pago`, un servicio con métodos internos y un único endpoint HTTP de consulta para el back office.

## Summary

Implementar el módulo `pagos` (Type C — servicio puramente operacional) sobre el Innoview Backend Template. El módulo no extiende `BaseCrudTenantService` sino que gestiona la tenancy directamente mediante `tenantContext`. Expone un único endpoint `GET /admin/pagos/:pedidoId` y cinco métodos internos consumidos por otros módulos. La entidad `Pago` no tiene soft delete; el multi-tenant scope se aplica manualmente en todas las queries.

## Technical Context

**Language/Version**: TypeScript / Node.js 20

**Primary Dependencies**: NestJS 10, TypeORM 0.3, class-validator, nestjs-pino

**Storage**: PostgreSQL — tabla `pagos` con UNIQUE constraint en `pedido_id` (1 pedido = 1 pago)

**Testing**: Validación manual con Postman/HTTP client

**Target Platform**: Railway (Linux container)

**Project Type**: NestJS REST API — módulo de soporte dentro del monolito multi-tenant

**Performance Goals**: Sin SLAs especificados; operaciones ligeras de lectura/escritura puntual

**Constraints**:
- `PagosService` NO extiende `BaseCrudTenantService` — tenancy resuelta via `tenantContext` directamente
- Sin soft delete en la entidad `Pago` — pagos no se eliminan jamás
- `PagosModule` no importa `PedidosModule` (evitar circular dep); `pedido_id` es FK plain
- `PedidosModule` importa `PagosModule` para usar `PagosService`
- `throw new Error()` prohibido; `AppError` obligatorio
- Sin auditoría en este módulo

**Scale/Scope**: 1 registro de pago por pedido; operación de cafetería ~100 pedidos/día

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Template API Contract | ✅ PASS | `ok()` en el único endpoint; `AppError` con `ErrorCodes` para los 3 errores nuevos |
| II. Multi-Tenancy by Default | ✅ PASS | `tenantContext` resuelve `tenant_id` directamente; todas las queries incluyen filtro de tenant; scoping manual equivalente a `BaseCrudTenantService` |
| III. Role-Based Access Control | ✅ PASS | Único endpoint `GET /:pedidoId` protegido con `JwtAuthGuard + RolesGuard`; no hay rutas públicas |
| IV. Business Rule Integrity | ✅ PASS | Uniqueness via DB constraint (`UNIQUE pedido_id`); validación de estado en `registrarCobroPresencial`; importe inmutable post-creación |
| V. Audit Trail | ✅ PASS | Ninguna acción requiere auditoría directa (per spec); responsabilidad delegada a módulos llamadores |
| VI. Module Architecture | ✅ PASS | Type C (puramente operacional); estructura correcta; enums en `pago.enums.ts`; sin CRUD base |
| VII. Implementation Discipline | ✅ PASS | Stage 3 — todos los módulos previos completos; `pedidos` completo |

**Nota sobre BaseEntity**: La entidad `Pago` define sus columnas directamente (no extiende `BaseEntity` del proyecto que incluye `deleted_at`): `id` (uuid PK), `tenant_id`, `created_at`, `updated_at`. Esto es correcto para un módulo Type C sin soft delete.

**Post-design re-check**: ✅ Sin violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/012-pagos/
├── plan.md              # Este archivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── admin-pagos.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code

```text
src/modules/pagos/
├── entities/
│   └── pago.entity.ts           # @Entity('pagos'), columnas directas sin soft delete
├── pago.enums.ts                # EstadoPago, MedioPago
├── pagos.service.ts             # Servicio puro sin BaseCrudTenantService
├── pagos.controller.ts          # GET /admin/pagos/:pedidoId
└── pagos.module.ts

src/common/errors/error-codes.ts   # Agregar PAGO_NOT_FOUND, PAGO_YA_COBRADO, PAGO_YA_EXISTE

src/app.module.ts                  # Agregar PagosModule

src/modules/pedidos/pedidos.module.ts  # Agregar PagosModule a imports
src/modules/pedidos/pedidos.service.ts # Inyectar PagosService; llamar crearPago* en _crearPedidoCore y cancelarPago en cancelar*

migrations/
└── TIMESTAMP-CreatePagos.ts       # npm run db:migration:generate
```

**Structure Decision**: Módulo único en `src/modules/pagos/`. Sin controller público. Controller admin con un solo endpoint. `PagosService` expone todos los métodos internos para ser consumidos por otros módulos.

## Integration with PedidosModule

La integración requiere modificar módulo y service de pedidos ya existente:

1. **`pedidos.module.ts`**: Agregar `PagosModule` a `imports`.
2. **`pedidos.service.ts`**: Inyectar `PagosService`; llamar `crearPagoPresencial()` o `crearPagoOnline()` dentro de `_crearPedidoCore()` antes del `commitTransaction()`. Si el pago falla, la transacción del pedido hace rollback.
3. **`cancelarDesdePortal` y `cancelarDesdeAdmin`**: Llamar `cancelarPago(pedido.id)` tras actualizar el pedido.
