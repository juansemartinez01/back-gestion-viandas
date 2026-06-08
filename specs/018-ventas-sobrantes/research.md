# Research: Ventas de Sobrantes

**Feature**: 018-ventas-sobrantes | **Date**: 2026-06-08

Todas las incógnitas técnicas fueron resueltas inspeccionando el código existente. No se requirieron fuentes externas.

---

## Decisión 1: Patrón transaccional

- **Decision**: `createQueryRunner()` con manejo explícito de connect/start/commit/rollback/release
- **Rationale**: Patrón establecido en `EntregasService`. Permite pasar `qr.manager` a operaciones que necesitan compartir el contexto transaccional (StockVianda SELECT FOR UPDATE + MovimientoStockVianda + VentaSobrante + audit).
- **Alternatives considered**: `DataSource.transaction(callback)` — no permite operar en el mismo lock de conexión cuando hay múltiples repositorios y el servicio externo tiene su propia transacción.

## Decisión 2: Mutación de stock dentro del QueryRunner (no via consumirParaSobrante)

- **Decision**: La mutación de `stock_vendido_sobrante` y la creación del `MovimientoStockVianda` se realizan directamente sobre `qr.manager` sin llamar a `StockViandasService.consumirParaSobrante()`.
- **Rationale**: `consumirParaSobrante` usa `this.dataSource.transaction()` internamente, lo que abre una conexión separada. Si la transacción del QueryRunner hace rollback después del commit interno de `consumirParaSobrante`, el stock queda decrementado sin registro de venta — violación de la Regla 6 de la constitución.
- **Alternatives considered**: Modificar `consumirParaSobrante` para aceptar un `EntityManager` externo — viable a futuro pero fuera del alcance de este módulo. Por convención, la misma lógica de actualización se replica localmente (patrón ya visto en otros módulos operacionales).

## Decisión 3: Entidad VentaSobrante no extiende BaseEntity

- **Decision**: Definir columnas manualmente (igual que `EntregaPedido`), sin heredar `BaseEntity`.
- **Rationale**: `BaseEntity` agrega `updated_at` y `deleted_at`. Un registro de venta es inmutable — no tiene sentido lógico ni legal modificarlo o borrarlo softamente. `EntregaPedido` usa el mismo patrón (verificado en `src/modules/entregas/entities/entrega-pedido.entity.ts`).
- **Alternatives considered**: Extender `BaseEntity` e ignorar las columnas — posible, pero agrega columnas innecesarias a la tabla y puede habilitar soft-delete accidental.

## Decisión 4: Validación de OrdenProduccion

- **Decision**: Buscar `OrdenProduccionVianda` por `(tenant_id, fecha_produccion, sede_id, punto_retiro_id, menu_publicado_id)`. El unique index `uq_opv_combinacion` garantiza como máximo un registro.
- **Rationale**: El enum `EstadoOrdenProduccion` en el entity (verificado) define `CONFIRMADA_COMPLETA` y `CONFIRMADA_CON_DIFERENCIA` como los estados válidos post-confirmación.
- **Alternatives considered**: Buscar solo por (tenant_id, fecha, sede_id) y validar múltiples menús — innecesario, la búsqueda por combinación completa es más precisa.

## Decisión 5: Precio unitario

- **Decision**: `precio_unitario = menuPublicado.precio_sobrante ?? menuPublicado.precio_encargo`
- **Rationale**: El campo `precio_sobrante` en `MenuPublicado` es `nullable: true` (verificado en entity). El fallback a `precio_encargo` (siempre presente) garantiza que siempre haya un precio aplicable. Si ambos fueran null sería un error en la gestión del menú — no un caso de negocio de ventas-sobrantes.
- **Alternatives considered**: Lanzar error si `precio_sobrante` es null — descartado porque la constitución del negocio acepta usar `precio_encargo` como fallback.

## Decisión 6: Error codes nuevos

- **Decision**: Agregar `VENTA_SOBRANTE_NOT_FOUND` y `SOBRANTE_PRODUCCION_NO_CONFIRMADA` a `ErrorCodes`.
- **Rationale**: Los existentes `STOCK_INSUFICIENTE_SOBRANTES` (409) y `STOCK_VIANDA_NOT_FOUND` (404) ya cubren los errores de stock. Los nuevos códigos cubren casos específicos de ventas-sobrantes no cubiertos previamente.
- **Alternatives considered**: Reutilizar `NOT_FOUND` y `CONFLICT` genéricos — descartado; la constitución exige códigos semánticos por dominio.

## Decisión 7: StockViandasModule — imports requeridos

- **Decision**: Importar `StockViandasModule` en el módulo (para acceder a `StockViandasService` aunque no se llame `consumirParaSobrante` directamente). Registrar `StockVianda` y `MovimientoStockVianda` en `TypeOrmModule.forFeature()` para acceso directo al repositorio.
- **Rationale**: Necesitamos los repositorios de StockVianda y MovimientoStockVianda directamente en el servicio de ventas-sobrantes para operar dentro del QueryRunner. El módulo `StockViandasModule` debe exportar las entidades o el servicio para que sean inyectables.

## Módulos existentes confirmados (no requieren modificación)

| Módulo | Verificado | Observación |
|--------|-----------|-------------|
| `StockViandasModule` | ✅ | `consumirParaSobrante` existe; repositorios accesibles via `TypeOrmModule.forFeature` propio |
| `MenusPublicadosModule` | ✅ | `MenuPublicado` entity con `precio_sobrante` y `precio_encargo` |
| `ProduccionViandasModule` | ✅ | `OrdenProduccionVianda` con enum de estados confirmados |
| `AuditModule` | ✅ | `AuditService.write()` disponible; `auditLogPayload` helper en common |
| `TenancyModule` | ✅ | `TenancyService.requireTenantId()` disponible |
