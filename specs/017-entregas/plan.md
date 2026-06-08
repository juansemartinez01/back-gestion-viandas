# Implementation Plan: Entregas de Viandas

**Branch**: `017-entregas` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/017-entregas/spec.md`

## Summary

El módulo `entregas` registra el retiro efectivo de viandas encargadas por clientes. El operador de caja busca el pedido por DNI, valida su estado y disponibilidad de stock, registra el cobro presencial si corresponde, y marca el pedido como entregado — todo en una transacción atómica usando QueryRunner. El módulo no extiende ningún servicio base (Type C puro) y exporta `EntregasService` para consumo por el módulo `cierres-operativos`.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, AuditModule (interno), TenancyModule (interno), PagosModule, PedidosModule, StockViandasModule

**Storage**: PostgreSQL — una tabla nueva: `entrega_pedidos`

**Testing**: Jest (unit/integration según convención del template)

**Target Platform**: Servidor Node.js / Railway (dev) — AWS-compatible

**Project Type**: Módulo NestJS (web-service backend)

**Performance Goals**: `buscarPorDni` debe responder en < 2 segundos bajo carga operacional; `registrarEntrega` en < 1 segundo (incluyendo SELECT FOR UPDATE y actualización de stock)

**Constraints**: QueryRunner obligatorio para atomicidad; SELECT FOR UPDATE en pedido para evitar doble entrega concurrente; idempotencia verificada antes de cualquier mutación; no soft delete en EntregaPedido

**Scale/Scope**: Módulo operativo diario; volumen esperado: decenas de entregas por día, una por pedido confirmado

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | PASS | Todos los endpoints usan `ok()` / `page()` de `api-response.ts`; errores vía `AppError` con `ErrorCodes` |
| II. Multi-Tenancy by Default | PASS | Todas las queries scoped por `tenant_id`; `TenancyService.requireTenantId()` en el servicio; SELECT FOR UPDATE también incluye `tenant_id` |
| III. Role-Based Access Control | PASS | `JwtAuthGuard` + `RolesGuard` + `@Roles()` en todos los endpoints según spec; roles: administrador, operador_caja (escritura), supervisor (solo lectura) |
| IV. Business Rule Integrity | PASS | SELECT FOR UPDATE en pedido; verificación idempotencia antes de mutación; validación estado_pedido; stock consumido solo con disponibilidad confirmada |
| V. Audit Trail | PASS | `entrega.registrada` auditado via `AuditService.write()` dentro de la transacción QueryRunner |
| VI. Module Architecture | PASS | Estructura: entities/, dto/, service, controller, module; Type C (sin BaseCrudTenantService); lógica en servicio; enums importados desde módulo pedidos |
| VII. Implementation Discipline | PASS | Stage 6 (Daily Operations): primer módulo del stage; produccion-viandas y stock-viandas (Stage 5) completos |

**Nota transaccional**: `StockViandasService.consumirParaEntrega` abre su propia transacción interna (`DataSource.transaction()`), lo que implica una conexión separada del QueryRunner principal. Ver `research.md` para el análisis completo y la decisión de diseño adoptada. La actualización del `Pago` (cobro presencial) se realiza inline vía `qr.manager` para garantizar atomicidad total con el EntregaPedido.

**Post-design re-check**: PASS — ver `research.md` para decisiones de diseño detalladas.

## Project Structure

### Documentation (this feature)

```text
specs/017-entregas/
├── plan.md              ← este archivo
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── api-endpoints.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/modules/entregas/
├── entities/
│   └── entrega-pedido.entity.ts
├── dto/
│   ├── crear-entrega.dto.ts
│   ├── query-entregas.dto.ts
│   └── buscar-por-dni.dto.ts
├── entregas.service.ts
├── entregas.controller.ts
└── entregas.module.ts

src/common/errors/error-codes.ts   ← agregar 4 nuevos códigos
src/app.module.ts                  ← registrar EntregasModule
migrations/
└── {timestamp}-CreateEntregas.ts
```

**Structure Decision**: Módulo NestJS estándar bajo `src/modules/entregas/`. Entidad en subdirectorio `entities/`, DTOs en `dto/`. No hay enums propios — los enums relevantes (`EstadoPedido`, `MedioPagoPedido`) se importan desde `pedidos` y `pagos` respectivamente.

## Complexity Tracking

> Sin violaciones justificadas — no aplica.
