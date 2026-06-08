# Research: Stock Operativo de Viandas

**Branch**: `016-stock-viandas` | **Date**: 2026-06-08

## Decisión 1: Control de concurrencia — SELECT FOR UPDATE vs Optimistic Locking

**Decision**: SELECT FOR UPDATE dentro de `DataSource.transaction()` para `consumirParaEntrega` y `consumirParaSobrante`.

**Rationale**: La constitución (principio IV, regla 6) lo exige explícitamente. SELECT FOR UPDATE garantiza que la fila de `stock_viandas` queda bloqueada hasta que el UPDATE se confirma, impidiendo que otra transacción simultánea lea el mismo valor de `stock_entregado` antes de que el primero lo incremente. Con optimistic locking, se produciría un conflicto que requeriría reintentos en el cliente — inapropiado para operaciones de caja donde el operador espera respuesta inmediata.

**Alternatives considered**:
- Optimistic locking (`@Version`): produce `OptimisticLockVersionMismatchError` bajo contención, obligando al caller a reintentar. Menos adecuado para este caso de uso.
- Semáforo en memoria (Redis): no disponible en el stack actual; además no sobrevive a reinicios.

## Decisión 2: stock_restante — columna explícita vs derivada en queries

**Decision**: `stock_restante` es una columna INTEGER en la tabla, recalculada en cada operación que modifica los contadores (`generarDesdeProduccion`, `consumirParaEntrega`, `consumirParaSobrante`, `ajustarStock`, `reasignarCancelacion`).

**Rationale**: La fórmula `stock_reservado_encargues - stock_entregado + stock_disponible_sobrantes - stock_vendido_sobrante + stock_ajustado` se puede consultar con una expresión derivada en el ORM, pero hacerla columna persistida permite:
1. Consultas filtradas / ordenadas por `stock_restante` sin costo de cómputo.
2. Detección rápida de alerta (stock_restante < 0) desde back office.
3. Coherencia: si algún bug dejase los contadores desfasados, `stock_restante` persiste el valor correcto que fue validado y guardado en la transacción.

**Alternatives considered**:
- Columna generada en PostgreSQL (`GENERATED ALWAYS AS ...`): requiere migración con raw SQL y limita el control sobre TypeORM; además dificulta override de valores en ajustes manuales excepcionales.
- Cálculo en cada respuesta del servicio: introduce riesgo de divergencia si algún path olvida el cálculo.

## Decisión 3: MovimientoStockVianda — inmutabilidad

**Decision**: No agregar `updated_at` ni soft delete a `MovimientoStockVianda`. El servicio nunca llama a `update()` ni `softDelete()` sobre esta entidad.

**Rationale**: Los movimientos son el ledger de auditoría del stock. Si un movimiento debe ser revertido operativamente (ej. entrega errónea), se registra un nuevo movimiento compensatorio — nunca se modifica el original. Esto garantiza trazabilidad completa y no-repudiabilidad.

**Alternatives considered**:
- Soft delete en movimientos: no tiene sentido semántico; un movimiento borrado es evidencia destruida.
- Campo `revertido_por_id`: posible extensión futura para vincular movimiento original con compensatorio, pero no requerido en esta iteración.

## Decisión 4: Servicio NO extiende BaseCrudTenantService

**Decision**: `StockViandasService` inyecta directamente `DataSource` y los repositorios necesarios, sin extender `BaseCrudTenantService`.

**Rationale**: `BaseCrudTenantService` provee CRUD convencional (create/findAll/findOne/update/remove). Este módulo no expone creación manual de stock (se crea solo desde producción), ni update genérico, ni delete. Los métodos centrales requieren transacciones explícitas con SELECT FOR UPDATE, que no encajan en el ciclo de vida del servicio base. Forzar la herencia implicaría sobreescribir casi todos los métodos heredados — antipatrón.

**Tenancy**: Se inyecta `TenancyService` para llamar a `requireTenantId()` en los métodos que no reciben `tenantId` por parámetro (endpoints de back office).

**Alternatives considered**:
- Extender BaseCrudTenantService y sobreescribir métodos de consumo: más acoplamiento, menos claridad de intención.

## Decisión 5: generarDesdeProduccion — fórmula de stock_reservado_encargues

**Decision**: `stock_reservado_encargues = orden.cantidad_pago_online + orden.cantidad_pago_presencial` (sin descontar cancelaciones).

**Rationale**: Al momento de confirmar producción, el campo `cantidad_cancelaciones_descontadas` de `OrdenProduccionVianda` ya está calculado en la generación de la orden. Sin embargo, para el stock, los encargues son los pedidos en estados CONFIRMADO_PAGO_ONLINE y CONFIRMADO_PAGO_PRESENCIAL al momento de la confirmación — estos son los pedidos que tienen derecho a retirar. Las cancelaciones que ocurran después de confirmar producción se manejan con `reasignarCancelacion`. La fórmula asegura que `stock_reservado_encargues` representa fielmente los pedidos pendientes de entrega.

**Nota de implementación**: `reasignarCancelacion` se llama desde el módulo de pedidos/cancelaciones cuando un pedido en estado CONFIRMADO se cancela después de que la producción está confirmada. El servicio busca el `StockVianda` del día correspondiente usando `fecha_pedido` del pedido.

## Decisión 6: forwardRef para dependencia circular

**Decision**: `StockViandasModule` importa `ProduccionViandasModule` con `forwardRef(() => ProduccionViandasModule)`. En la dirección opuesta, `ProduccionViandasModule` importará `StockViandasModule` con `forwardRef(() => StockViandasModule)`.

**Rationale**: `ProduccionViandasService.confirmarProduccion()` necesita llamar a `StockViandasService.generarDesdeProduccion()`. `StockViandasService.reasignarCancelacion()` necesita leer `OrdenProduccionVianda` para determinar si la producción ya fue confirmada. Esto crea una dependencia bidireccional que NestJS resuelve con `forwardRef`. Los TODOs ya están preparados en `produccion-viandas.module.ts` y `produccion-viandas.service.ts`.

**Alternativa considerada**: Mover `reasignarCancelacion` al módulo de cancelaciones-pedidos e inyectar `StockViandasService` allí en lugar de en `ProduccionViandasService`. Esto evitaría el forwardRef pero requeriría que cancelaciones-pedidos conozca la lógica de stock — mayor acoplamiento en otro módulo.

**Nota de implementación (post-implement)**: La llamada a `reasignarCancelacion` fue integrada en `PedidosService` (no en `CancelacionesPedidosService` como se había considerado), ya que la lógica real de cancelación reside en `PedidosService.cancelarDesdePortal()` y `PedidosService.cancelarDesdeAdmin()`. `CancelacionesPedidosService` solo gestiona registros de cancelaciones, sin alterar el estado del pedido. La integración usa `forwardRef(() => StockViandasModule)` en `PedidosModule`.

## Decisión 7: Códigos de error nuevos

Los siguientes códigos deben agregarse a `src/common/errors/error-codes.ts` en la sección `// stock-viandas`:

```typescript
STOCK_VIANDA_NOT_FOUND: 'STOCK_VIANDA_NOT_FOUND',           // 404
STOCK_INSUFICIENTE_ENTREGAS: 'STOCK_INSUFICIENTE_ENTREGAS', // 409
STOCK_INSUFICIENTE_SOBRANTES: 'STOCK_INSUFICIENTE_SOBRANTES', // 409
STOCK_AJUSTE_INVALIDO: 'STOCK_AJUSTE_INVALIDO',             // 422
```

## Decisión 8: ajustarStock — restricción de ajuste negativo

**Decision**: El ajuste negativo NO bloquea si `stock_restante` quedaría negativo. El ajuste se aplica siempre, quedando reflejado en back office.

**Rationale**: La spec indica que `stock_restante` puede ser negativo como señal de alerta (assumption documentada en spec). Los ajustes manuales son correcciones excepcionales de supervisores/administradores que conocen la situación operativa. Bloquear ajustes negativos limitaría la capacidad de corrección en escenarios de emergencia.

**Alternativa considerada**: Bloquear ajuste negativo si `stock_restante < cantidad` → usar `STOCK_AJUSTE_INVALIDO`. Descartado porque la spec lo permite explícitamente como señal de alerta.

## Dependencias externas verificadas

- `OrdenProduccionVianda` entity: ✅ campos `cantidad_pago_online`, `cantidad_pago_presencial`, `cantidad_real_producida`, `fecha_produccion`, `sede_id`, `punto_retiro_id`, `menu_publicado_id` disponibles.
- `Pedido` entity: ✅ campos `fecha_pedido`, `sede_id`, `punto_retiro_id`, `menu_publicado_id`, `estado_pedido` disponibles.
- `AuditModule`: ✅ presente en `produccion-viandas.module.ts` como referencia de uso.
- `TenancyModule`: ✅ presente en múltiples módulos existentes.
- `ErrorCodes`: ✅ archivo en `src/common/errors/error-codes.ts`, patrón identificado.
- `BaseEntity`: ✅ provee `id`, `tenant_id`, `created_at`, `updated_at`, soft delete — StockVianda la extiende; MovimientoStockVianda extiende una versión sin `updated_at` o declara columnas manuales.
