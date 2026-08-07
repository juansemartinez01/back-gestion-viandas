# Roles permissions matrix

This document is the target access matrix for the canonical role contract:

- `Admin`
- `Vendedor`
- `Cocina`

It documents the intended permissions after migrating legacy role names. It does not describe the current code behavior.

## Mapping rule

| Current/legacy roles | Target role |
| --- | --- |
| `admin`, `administrador`, `supervisor` | `Admin` |
| `operador_caja`, `vendedor` | `Vendedor` |
| `cocina` | `Cocina` |

## Global policy

`Admin` keeps full backoffice administration permissions.

`Vendedor` keeps operational sales/order/closing permissions previously granted to `operador_caja` and `vendedor`.

`Cocina` is limited to production/listing flows related to `Produccion de viandas`.

## Backoffice endpoints

| Area | Endpoint(s) | Target roles | Notes |
| --- | --- | --- | --- |
| Admin users | `GET/POST/PATCH/DELETE /admin/users*` | `Admin` | User and user-role administration only. |
| Admin roles | `GET/POST/PATCH/DELETE /admin/roles*` | `Admin` | Role catalog administration only. Creation must later sync by exact name with Kiosco. |
| Auth admin check | `GET /auth/admin-only` | `Admin` | Replace legacy `admin`/`administrador`. |
| Audit logs | `GET /admin/audit-logs*` | `Admin` | Audit access remains admin-only. |
| Mercado Pago logs | `GET /admin/mercado-pago/logs*` | `Admin` | Payment/webhook log audit remains admin-only. |
| Master data read | `GET /admin/alergenos*`, `/admin/banners*`, `/admin/categorias-menu*`, `/admin/etiquetas-menu*`, `/admin/menus-base*`, `/admin/puntos-retiro*`, `/admin/sedes*` | `Admin` | Former supervisor read-only access maps to `Admin`. |
| Master data write | `POST/PATCH/DELETE /admin/alergenos*`, `/admin/banners*`, `/admin/categorias-menu*`, `/admin/etiquetas-menu*`, `/admin/menus-base*`, `/admin/puntos-retiro*`, `/admin/sedes*` | `Admin` | No `Vendedor` or `Cocina`. |
| Clientes | `GET /admin/clientes*`, `PATCH /admin/clientes/:id/bloquear`, `PATCH /admin/clientes/:id/desbloquear` | `Admin` | Customer blocking/unblocking remains admin-only. |
| Menus publicados read/create/transitions | `GET/POST /admin/menus-publicados*`, `PATCH /admin/menus-publicados/:id/pausar`, `/reactivar`, `/cerrar`, `/agotar`, `/cancelar` | `Admin` | Former supervisor access maps to `Admin`. Internal cancel rule must also check `Admin`. |
| Menus publicados edit/delete | `PATCH /admin/menus-publicados/:id`, `DELETE /admin/menus-publicados/:id` | `Admin` | Admin-only. |
| Pedidos read/cancel | `GET /admin/pedidos*`, `POST /admin/pedidos/:id/cancelar` | `Admin`, `Vendedor` | Operational backoffice access. |
| Pedidos manual create | `POST /admin/pedidos/manual` | `Admin` | Former supervisor maps to `Admin`; `Vendedor` remains excluded. |
| Pedidos update | `PATCH /admin/pedidos/:id` | `Admin` | Admin-only. |
| Pagos | `GET /admin/pagos/:pedidoId` | `Admin`, `Vendedor` | Operational payment lookup. |
| Entregas create/search | `POST /admin/entregas`, `GET /admin/entregas/buscar-por-dni` | `Admin`, `Vendedor` | Operational delivery flow. |
| Entregas list/detail | `GET /admin/entregas`, `GET /admin/entregas/:id` | `Admin`, `Vendedor` | Former supervisor maps to `Admin`. |
| Cierres resumen/crear | `GET /admin/cierres-operativos/resumen-previo`, `POST /admin/cierres-operativos` | `Admin`, `Vendedor` | Operational closing flow. |
| Cierres list/detail | `GET /admin/cierres-operativos`, `GET /admin/cierres-operativos/:id` | `Admin`, `Vendedor` | Former supervisor maps to `Admin`. |
| Ventas sobrantes create/disponibles | `POST /admin/ventas-sobrantes`, `GET /admin/ventas-sobrantes/disponibles` | `Admin`, `Vendedor` | Operational leftovers flow. |
| Ventas sobrantes list/detail | `GET /admin/ventas-sobrantes`, `GET /admin/ventas-sobrantes/:id` | `Admin`, `Vendedor` | Former supervisor maps to `Admin`. |
| Stock viandas read/adjust | `GET /admin/stock-viandas*`, `POST /admin/stock-viandas/:id/ajustar` | `Admin`, `Vendedor` | Keeps previous `operador_caja`/`vendedor` operational access. |
| Stock movements | `GET /admin/stock-viandas/:id/movimientos` | `Admin` | Former supervisor maps to `Admin`; `Vendedor` remains excluded. |

## Produccion de viandas

`Cocina` access is intentionally limited to this area.

| Endpoint | Target roles | Notes |
| --- | --- | --- |
| `GET /admin/produccion-viandas` | `Admin`, `Cocina` | List production orders. |
| `GET /admin/produccion-viandas/imprimible` | `Admin`, `Cocina` | Printable production view. |
| `GET /admin/produccion-viandas/:id` | `Admin`, `Cocina` | Production order detail. |
| `POST /admin/produccion-viandas/generar` | `Admin`, `Cocina` | Explicit requirement: `Cocina` can generate production. |
| `PATCH /admin/produccion-viandas/:id/en-produccion` | `Admin`, `Cocina` | Recommended because it is part of the kitchen operational workflow. |
| `POST /admin/produccion-viandas/:id/confirmar` | `Admin`, `Cocina` | Explicit requirement: `Cocina` can confirm production. |

## Public and authenticated-only endpoints

Public endpoints remain unrestricted by role.

Endpoints that only use JWT authentication and do not declare `@Roles(...)` remain authenticated-only unless a later stage explicitly adds role restrictions.

## Implementation notes for the next stages

- Decorators must use `Admin`, `Vendedor`, and `Cocina` exactly.
- Role storage in this backend must stop lowercasing canonical role names.
- Legacy roles must be migrated to canonical roles before old names are removed from decorators.
- Existing JWTs issued with legacy role names will not match the new decorators; users should log in again after migration/deploy.
- The internal `menus-publicados` cancellation rule must switch from checking `administrador` to checking `Admin`.
