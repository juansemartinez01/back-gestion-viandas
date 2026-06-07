# Implementation Plan: Pedidos (Gestión de Pedidos de Viandas)

**Branch**: `011-pedidos` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Módulo transaccional central — gestión de pedidos de viandas desde portal público y back office, con ciclo de vida de estados, reglas de pago, y cancelaciones.

## Summary

Implementar el módulo `pedidos` (Type B — CRUD + business logic) sobre el Innoview Backend Template. El módulo expone un endpoint público sin autenticación para crear/consultar/cancelar pedidos, y un endpoint admin protegido con roles para gestión back-office. Incluye un cron job para expirar reservas online automáticamente. La clave técnica es el control de concurrencia en la validación de capacidad y generación de código público (`SELECT FOR UPDATE` dentro de una transacción).

## Technical Context

**Language/Version**: TypeScript / Node.js 20 (mismo que el resto del proyecto)

**Primary Dependencies**: NestJS 10, TypeORM 0.3, class-validator, @nestjs/schedule (ya instalado), nestjs-pino

**Storage**: PostgreSQL (gestionado por Railway), TypeORM migrationsRun: true

**Testing**: No hay suite de tests automatizados en el proyecto — validación manual con Postman/HTTP client

**Target Platform**: Railway (Linux container)

**Project Type**: NestJS REST API — módulo dentro de monolito multi-tenant

**Performance Goals**: Sin SLAs especificados; throughput razonable para operación de cafetería (<100 pedidos concurrentes)

**Constraints**: Control de concurrencia obligatorio en verificación de capacidad; precio_unitario/importe_total inmutables post-creación; `throw new Error()` prohibido; todas las queries deben llevar tenant scope

**Scale/Scope**: ~1 tenant por deploy, operación diaria con picos en horario de almuerzo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Template API Contract | ✅ PASS | Usar `ok()`/`page()` en todos los responses; `AppError` con `ErrorCodes` para errores; 8 nuevos error codes agregados a `error-codes.ts` |
| II. Multi-Tenancy by Default | ✅ PASS | `PedidosService` extiende `BaseCrudTenantService`; todas las queries llevan `tenant_id`; endpoints públicos resuelven tenant desde `x-tenant-key` header vía TenancyMiddleware existente |
| III. Role-Based Access Control | ✅ PASS | `PublicPedidosController` sin `JwtAuthGuard` (excepción documentada, 3 rutas); `PedidosController` con `JwtAuthGuard + RolesGuard`; roles per-endpoint según spec |
| IV. Business Rule Integrity | ✅ PASS | Invariante de precio: `precio_unitario`/`importe_total` nunca en `UpdatePedidoDto`; state machine en enums; `SELECT FOR UPDATE` en capacidad; job de expiración automática |
| V. Audit Trail | ✅ PASS | `pedido.manual.created`, `pedido.cancelado.admin`, `pedido.updated` escritos con `AuditService.write()` en misma transacción |
| VI. Module Architecture | ✅ PASS | Type B (CRUD + business logic); estructura de archivos correcta; enums en `pedido.enums.ts`; DTOs con class-validator; lógica en service, no en controller |
| VII. Implementation Discipline | ✅ PASS | Stage 3 — todos los módulos Stage 1 y Stage 2 están completos (sedes, puntos-retiro, clientes, menus-publicados, etc.) |

**Post-design re-check**: ✅ Sin violaciones identificadas en el diseño de Phase 1.

## Project Structure

### Documentation (this feature)

```text
specs/011-pedidos/
├── plan.md              # Este archivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── public-pedidos.md
│   └── admin-pedidos.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code

```text
src/modules/pedidos/
├── entities/
│   └── pedido.entity.ts           # @Entity('pedidos'), extends BaseEntity
├── dto/
│   ├── create-pedido-publico.dto.ts
│   ├── create-pedido-manual.dto.ts
│   ├── update-pedido.dto.ts
│   ├── query-pedido.dto.ts
│   └── cancelar-pedido.dto.ts
├── pedido.enums.ts                # EstadoPedido, EstadoPagoPedido, MedioPagoPedido, OrigenCancelacion
├── pedidos.service.ts             # BaseCrudTenantService<Pedido>
├── pedidos.controller.ts          # /admin/pedidos — JwtAuthGuard + RolesGuard
├── public-pedidos.controller.ts   # /public/pedidos — sin guard
├── pedidos-expiracion.job.ts      # @Cron cada 5 min
└── pedidos.module.ts

src/common/errors/error-codes.ts   # Agregar 8 nuevos error codes

src/app.module.ts                  # Agregar PedidosModule
```

**Structure Decision**: Módulo único en `src/modules/pedidos/`. Dos controllers (admin y público) en el mismo módulo para compartir el service. Job de expiración como provider en el mismo módulo.

## Complexity Tracking

> Sin violaciones a la constitución. No se requiere esta sección.
