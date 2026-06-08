# Implementation Plan: Stock Operativo de Viandas

**Branch**: `016-stock-viandas` | **Date**: 2026-06-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-stock-viandas/spec.md`

## Summary

El módulo `stock-viandas` gestiona el stock operativo de viandas producidas para el día. Se genera automáticamente al confirmar producción, separa unidades para encargues de unidades sobrantes para venta presencial, registra todos los movimientos con trazabilidad completa, y expone control de disponibilidad con SELECT FOR UPDATE para garantizar integridad bajo concurrencia. El módulo también expone endpoints de consulta y ajuste manual auditado desde back office, y publica `StockViandasService` para que los módulos de entregas y ventas-sobrantes consuman stock sin acceso directo a la BD.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, AuditModule (interno), TenancyModule (interno)

**Storage**: PostgreSQL — dos tablas nuevas: `stock_viandas`, `movimientos_stock_viandas`

**Testing**: Jest (unit/integration según convención del template)

**Target Platform**: Servidor Node.js / Railway (dev) — AWS-compatible

**Project Type**: Módulo NestJS (web-service backend)

**Performance Goals**: Operaciones de consumo con SELECT FOR UPDATE deben completarse en < 500ms bajo carga de hasta 20 solicitudes simultáneas sobre el mismo stock

**Constraints**: Control de concurrencia obligatorio en consumirParaEntrega y consumirParaSobrante; stock_restante calculado explícitamente en cada operación (no columna computada en DB); MovimientoStockVianda inmutable

**Scale/Scope**: Módulo de stock operativo diario; volumen esperado: decenas de registros de stock por día, centenares de movimientos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | PASS | Todos los endpoints usan `ok()` / `page()` de `api-response.ts`; errores vía `AppError` con `ErrorCodes` |
| II. Multi-Tenancy by Default | PASS | Todas las queries llevan `tenant_id`; `TenancyService.requireTenantId()` en el servicio; sin raw `repo.find()` sin tenant |
| III. Role-Based Access Control | PASS | `JwtAuthGuard` + `RolesGuard` + `@Roles()` en todos los endpoints; roles según spec |
| IV. Business Rule Integrity | PASS | SELECT FOR UPDATE en consumo; validación de stock disponible antes de descontar; movimientos inmutables |
| V. Audit Trail | PASS | Ajuste manual audita `stock.ajuste_manual` vía `AuditService.write()` en la misma transacción |
| VI. Module Architecture | PASS | Estructura: entities/, dto/, service, controller, module; enums en `stock-vianda.enums.ts`; lógica en servicio |
| VII. Implementation Discipline | PASS | Stage 5 (Production & Stock): produccion-viandas completo → stock-viandas (este módulo) |

**Nota de clasificación**: La constitución lista `stock-viandas` como Type B. Dado que el servicio NO extiende `BaseCrudTenantService` (por la complejidad transaccional y porque no hay CRUD de creación manual), se usa el patrón Type B en cuanto a estructura de archivos pero con servicio custom. Esto no viola la constitución — Type B aplica la base clase solo cuando aporta valor; aquí los métodos de consumo con transacción requieren control explícito.

**Post-design re-check**: PASS — ver `research.md` para decisiones de diseño detalladas.

## Project Structure

### Documentation (this feature)

```text
specs/016-stock-viandas/
├── plan.md              ← este archivo
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── contracts/
│   └── api-endpoints.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/modules/stock-viandas/
├── entities/
│   ├── stock-vianda.entity.ts
│   └── movimiento-stock-vianda.entity.ts
├── dto/
│   ├── ajustar-stock.dto.ts
│   └── query-stock.dto.ts
├── stock-vianda.enums.ts
├── stock-viandas.service.ts
├── stock-viandas.controller.ts
└── stock-viandas.module.ts

src/common/errors/error-codes.ts   ← agregar 4 nuevos códigos
src/app.module.ts                  ← registrar StockViandasModule
migrations/
└── {timestamp}-CreateStockViandas.ts

src/modules/produccion-viandas/   ← descomentar TODO de forwardRef
├── produccion-viandas.module.ts
└── produccion-viandas.service.ts
```

**Structure Decision**: Módulo NestJS estándar bajo `src/modules/stock-viandas/`. Entidades separadas en subdirectorio `entities/`, DTOs en `dto/`. Enums en archivo propio `stock-vianda.enums.ts` según principio VI de la constitución.

## Complexity Tracking

> Sin violaciones justificadas — no aplica.
