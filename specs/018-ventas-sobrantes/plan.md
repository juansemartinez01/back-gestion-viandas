# Implementation Plan: Ventas de Sobrantes

**Branch**: `018-ventas-sobrantes` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-ventas-sobrantes/spec.md`

## Summary

Módulo operativo transaccional (Type C) que registra ventas presenciales de viandas sobrantes con concurrencia segura mediante SELECT FOR UPDATE dentro de un único QueryRunner. Valida producción confirmada, descuenta stock de sobrantes sin tocar el stock de encargues, escribe un movimiento contable y audita la acción dentro de la misma transacción. Expone además consulta de disponibilidad y listado histórico filtrable. Exporta `VentasSobrantesService` para consumo desde `cierres-operativos`.

## Technical Context

**Language/Version**: TypeScript 5.x sobre NestJS 10.x

**Primary Dependencies**: TypeORM (QueryBuilder + QueryRunner), class-validator, class-transformer

**Storage**: PostgreSQL — tabla `ventas_sobrantes`; acceso a `stock_viandas`, `movimientos_stock_viandas`, `orden_produccion_vianda`, `menus_publicados`

**Testing**: Jest (unit) + e2e con Supertest según convención del proyecto

**Target Platform**: Railway (PostgreSQL) — compatible con cualquier entorno Postgres

**Project Type**: NestJS REST API — módulo Type C (operativo puro, sin CRUD base)

**Performance Goals**: Registro de venta < 2 s bajo carga normal; consulta de disponibles < 500 ms

**Constraints**: Cero overselling bajo concurrencia — SELECT FOR UPDATE garantizado; toda mutación de estado en una única transacción

**Scale/Scope**: Operación diaria de N sedes × M puntos de retiro; volumen bajo (decenas de ventas/día)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Evidencia |
|-----------|--------|-----------|
| I — Template API Contract | ✅ | `ok()` / `page()` en controller; `AppError` con `ErrorCodes` para todos los errores de negocio |
| II — Multi-Tenancy by Default | ✅ | `tenant_id` en entidad; `TenancyService.requireTenantId()` en todos los métodos del servicio; QueryBuilder con filtro tenant |
| III — RBAC | ✅ | `JwtAuthGuard` + `RolesGuard` + `@Roles()` en todos los endpoints; roles documentados: `administrador`, `supervisor`, `operador_caja` |
| IV — Business Rule Integrity | ✅ | Regla 4 (sobrantes solo post-producción confirmada), Regla 5 (counters separados), Regla 6 (SELECT FOR UPDATE) cumplidas en el flujo transaccional |
| V — Audit Trail | ✅ | `auditService.write('venta_sobrante.registrada')` dentro del mismo QueryRunner antes del commit |
| VI — Module Architecture | ✅ | Estructura Type C: entities/ dto/ service controller module; sin BaseCrudTenantService |
| VII — Implementation Discipline | ✅ | Stage 6 — depende de entregas (Stage 6a) completado |

**Violations**: Ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/018-ventas-sobrantes/
├── plan.md              ← este archivo
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── contracts/
│   └── ventas-sobrantes.api.md
└── tasks.md             ← generado por /speckit-tasks
```

### Source Code

```text
src/
├── common/
│   └── errors/
│       └── error-codes.ts          ← +2 códigos: VENTA_SOBRANTE_NOT_FOUND, SOBRANTE_PRODUCCION_NO_CONFIRMADA
└── modules/
    └── ventas-sobrantes/
        ├── entities/
        │   └── venta-sobrante.entity.ts
        ├── dto/
        │   ├── crear-venta-sobrante.dto.ts
        │   ├── query-ventas-sobrantes.dto.ts
        │   └── query-disponibles.dto.ts
        ├── ventas-sobrantes.service.ts
        ├── ventas-sobrantes.controller.ts
        └── ventas-sobrantes.module.ts

migrations/
└── <timestamp>-CreateVentasSobrantes.ts   ← generada con db:migration:generate
```

**Structure Decision**: Type C — módulo operativo puro sin herencia de `BaseCrudTenantService`. Misma estructura que `entregas` y `cancelaciones-pedidos`.

## Complexity Tracking

Sin violaciones — no se requiere esta sección.

---

## Phase 0: Research

### Decisión 1: Patrón transaccional — QueryRunner vs DataSource.transaction()

**Decision**: Se usa `createQueryRunner()` (igual que `EntregasService`) en lugar de `DataSource.transaction(callback)`.

**Rationale**: `DataSource.transaction()` abre una conexión implícita. `createQueryRunner()` permite pasar el `EntityManager` del runner a cualquier repositorio para garantizar que todas las operaciones (stock, movimiento, entidad VentaSobrante, auditoría) comparten el mismo contexto de transacción y el mismo lock de `SELECT FOR UPDATE`.

**Alternatives considered**:
- `DataSource.transaction(em => ...)` — descartado porque el `em` no se puede pasar fácilmente a `StockViandasService.consumirParaSobrante`, que abre su propia transacción interna.
- Llamar a `consumirParaSobrante` fuera del QueryRunner — descartado por romper atomicidad: si la creación de `VentaSobrante` falla después del `consumirParaSobrante`, el stock queda decrementado sin registro de venta.

### Decisión 2: Reutilización de consumirParaSobrante

**Decision**: NO se llama a `StockViandasService.consumirParaSobrante()` desde el servicio de ventas. En su lugar, las operaciones equivalentes (UPDATE de `stock_vendido_sobrante`, INSERT de `MovimientoStockVianda`) se ejecutan directamente sobre `qr.manager` dentro del QueryRunner.

**Rationale**: `consumirParaSobrante` abre su propia transacción interna mediante `this.dataSource.transaction()`. Llamarla desde el medio de una transacción de QueryRunner resulta en dos transacciones paralelas — si el QueryRunner hace rollback, el stock ya fue decrementado en la transacción interna. Para garantizar atomicidad plena (regla de negocio #6), la mutación de stock debe ocurrir dentro del mismo QueryRunner.

**Alternatives considered**:
- Modificar `consumirParaSobrante` para aceptar un `EntityManager` opcional — posible en el futuro, pero fuera del alcance de este módulo y requeriría cambios en `stock-viandas` y en `entregas`.

### Decisión 3: Validación de producción — qué campo consultar

**Decision**: Se busca `OrdenProduccionVianda` por `(tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id)` y se valida `estado IN [CONFIRMADA_COMPLETA, CONFIRMADA_CON_DIFERENCIA]`.

**Rationale**: Estos son los únicos dos estados que confirman que la producción del día está cerrada. El enum `EstadoOrdenProduccion` ya define estos valores en `orden-produccion-vianda.entity.ts`.

### Decisión 4: Entidad VentaSobrante — no extiende BaseEntity

**Decision**: `VentaSobrante` define sus propias columnas sin extender `BaseEntity` (igual que `EntregaPedido`).

**Rationale**: `BaseEntity` incluye `updated_at` y `deleted_at`. `VentaSobrante` es un registro inmutable de una transacción financiera — no se modifica ni se elimina lógicamente. Agregar esas columnas implicaría controles de soft-delete que no aplican y pueden llevar a borrado accidental.

### Decisión 5: Nuevos error codes requeridos

**Decision**: Agregar a `ErrorCodes`:
- `VENTA_SOBRANTE_NOT_FOUND` (404) — registro de venta no encontrado
- `SOBRANTE_PRODUCCION_NO_CONFIRMADA` (409) — producción del día no confirmada

**Rationale**: Los códigos `STOCK_INSUFICIENTE_SOBRANTES` y `STOCK_VIANDA_NOT_FOUND` ya existen y son reutilizables. Los dos nuevos cubren los casos específicos de este módulo que no están cubiertos por los existentes.

---

## Phase 1: Design & Contracts

→ Ver [data-model.md](./data-model.md) para el modelo de datos detallado.
→ Ver [contracts/ventas-sobrantes.api.md](./contracts/ventas-sobrantes.api.md) para contratos de API.

### Flujo transaccional detallado — registrarVenta

```
registrarVenta(dto, usuarioId):
  tenantId = tenancyService.requireTenantId()
  qr = dataSource.createQueryRunner()
  await qr.connect() && qr.startTransaction()
  try:
    // 1. Validar MenuPublicado
    mp = qr.manager.findOne(MenuPublicado, { id: dto.menu_publicado_id, tenant_id: tenantId })
    if !mp → throw AppError(MENU_PUBLICADO_NOT_FOUND, 404)

    // 2. Validar producción confirmada
    orden = qr.manager.findOne(OrdenProduccionVianda, {
      tenant_id: tenantId,
      fecha_produccion: dto.fecha,
      sede_id: dto.sede_id,
      punto_retiro_id: dto.punto_retiro_id,
      menu_publicado_id: dto.menu_publicado_id
    })
    estadosValidos = [CONFIRMADA_COMPLETA, CONFIRMADA_CON_DIFERENCIA]
    if !orden || !estadosValidos.includes(orden.estado)
      → throw AppError(SOBRANTE_PRODUCCION_NO_CONFIRMADA, 409)

    // 3. SELECT FOR UPDATE en StockVianda
    stock = qr.manager.getRepository(StockVianda)
      .createQueryBuilder('sv')
      .setLock('pessimistic_write')
      .where({ tenant_id, fecha: dto.fecha, sede_id, punto_retiro_id, menu_publicado_id })
      .getOne()
    if !stock → throw AppError(STOCK_VIANDA_NOT_FOUND, 404)

    // 4. Validar stock disponible
    disponible = stock.stock_disponible_sobrantes - stock.stock_vendido_sobrante
    if disponible < dto.cantidad → throw AppError(SOBRANTE_STOCK_INSUFICIENTE, 409)

    // 5. Calcular precio
    precioUnitario = mp.precio_sobrante ?? mp.precio_encargo
    importeTotal = precioUnitario * dto.cantidad

    // 6. Actualizar stock dentro del mismo QueryRunner
    stock.stock_vendido_sobrante += dto.cantidad
    stock.stock_restante = recalcularRestante(stock)
    await qr.manager.getRepository(StockVianda).save(stock)

    // 7. Crear VentaSobrante
    venta = qr.manager.getRepository(VentaSobrante).create({
      tenant_id: tenantId,
      fecha: dto.fecha,
      sede_id: dto.sede_id,
      punto_retiro_id: dto.punto_retiro_id,
      menu_publicado_id: dto.menu_publicado_id,
      cantidad: dto.cantidad,
      precio_unitario: precioUnitario,
      importe_total: importeTotal,
      usuario_id: usuarioId,
      observacion: dto.observacion ?? null
    })
    savedVenta = await qr.manager.getRepository(VentaSobrante).save(venta)

    // 8. Registrar movimiento de stock
    movimiento = qr.manager.getRepository(MovimientoStockVianda).create({
      tenant_id: tenantId,
      stock_vianda_id: stock.id,
      tipo_movimiento: CONSUMO_SOBRANTE,
      cantidad: -dto.cantidad,
      venta_sobrante_id: savedVenta.id,
      pedido_id: null,
      usuario_id: usuarioId,
      observacion: null
    })
    await qr.manager.getRepository(MovimientoStockVianda).save(movimiento)

    // 9. Auditar
    await auditService.write('admin', auditLogPayload({
      actorUserId: usuarioId,
      action: 'venta_sobrante.registrada',
      entity: 'venta_sobrante',
      extra: { venta_id: savedVenta.id, cantidad: dto.cantidad, importe_total: importeTotal }
    }))

    await qr.commitTransaction()
    return savedVenta (con menuPublicado cargado)
  catch (err):
    await qr.rollbackTransaction()
    throw err
  finally:
    await qr.release()
```

**Nota**: El stock se actualiza directamente en el QueryRunner (no a través de `consumirParaSobrante`) para garantizar atomicidad plena. Ver Decisión 2 en Phase 0.

### Flujo — listDisponibles

```
listDisponibles(query: QueryDisponiblesDto):
  tenantId = tenancyService.requireTenantId()
  qb = stockViandaRepo.createQueryBuilder('sv')
    .leftJoinAndSelect('sv.menuPublicado', 'mp')
    .leftJoinAndSelect('mp.menuBase', 'mb')
    .where('sv.tenant_id = :tenantId', { tenantId })
    .andWhere('sv.fecha = :fecha', { fecha: query.fecha })
    .andWhere('sv.sede_id = :sedeId', { sedeId: query.sede_id })
    .andWhere('(sv.stock_disponible_sobrantes - sv.stock_vendido_sobrante) > 0')
  if query.punto_retiro_id:
    qb.andWhere('sv.punto_retiro_id = :puntoRetiroId', ...)
  return qb.getMany()
    → mapeado a { menu_publicado_id, nombre_menu, precio_sobrante, precio_encargo, cantidad_disponible }
```

### Endpoints

| Método | Ruta | Roles | Auth |
|--------|------|-------|------|
| `POST` | `/admin/ventas-sobrantes` | administrador, operador_caja | JwtAuthGuard + RolesGuard |
| `GET` | `/admin/ventas-sobrantes/disponibles` | administrador, operador_caja | JwtAuthGuard + RolesGuard |
| `GET` | `/admin/ventas-sobrantes` | administrador, supervisor, operador_caja | JwtAuthGuard + RolesGuard |
| `GET` | `/admin/ventas-sobrantes/:id` | administrador, supervisor, operador_caja | JwtAuthGuard + RolesGuard |

**Importante**: `GET /disponibles` debe declararse antes de `GET /:id` en el controller para que NestJS no interprete "disponibles" como un UUID.
