# Research: Módulo Producción de Viandas

**Feature**: 015-produccion-viandas | **Date**: 2026-06-08

---

## Decisión 1: Estrategia de upsert para generarProduccion

**Decision**: Usar `findOne` + `save` (no `upsert` nativo de TypeORM) para el upsert de órdenes de producción.

**Rationale**: El `Repository.upsert()` de TypeORM con conflicto en unique constraint es viable, pero no permite la lógica de "SKIP si ya está confirmada/cancelada". La estrategia `findOne` + condicional explícito permite:
- Actualizar si está en `pendiente` o `en_produccion`
- Ignorar si ya está `confirmada_*` o `cancelada`
- Control total sobre qué campos actualizar

**Alternatives considered**:
- `repo.upsert()` — rechazado porque TypeORM no permite lógica condicional en el ON CONFLICT
- Query raw SQL con `INSERT ... ON CONFLICT DO UPDATE WHERE` — rechazado por regla de constitution (raw SQL prohibido excepto justificado)

---

## Decisión 2: Cálculo de pedidos por punto_retiro_id

**Decision**: Ejecutar tres queries `getRawMany()` con GROUP BY `punto_retiro_id` por cada menú publicado (una para online, una para presencial, una para cancelaciones), luego mergear los resultados en memoria.

**Rationale**: Este enfoque es simple, legible y alineado con el patrón ya usado en el módulo de cancelaciones. El volumen de datos es acotado (un día tiene a lo sumo decenas de puntos de retiro por menú), por lo que el procesamiento en memoria es negligible.

**Alternatives considered**:
- Un solo query con CASE WHEN — posible pero más frágil ante cambios en los estados del enum
- SubQuery TypeORM — más complejo y menos legible sin ventaja de rendimiento en este volumen

---

## Decisión 3: forwardRef para StockViandasService

**Decision**: Usar `forwardRef(() => StockViandasService)` en `ProduccionViandasModule` y `@Inject(forwardRef(() => StockViandasService))` en el constructor del service.

**Rationale**: `StockViandasModule` dependerá de `ProduccionViandasModule` (para leer órdenes de producción al generar stock) y `ProduccionViandasModule` dependerá de `StockViandasModule` (para generar stock al confirmar). El patrón `forwardRef` bidireccional ya existe en este proyecto para `PedidosModule` ↔ `MercadoPagoModule`.

**Alternatives considered**:
- Publicar un evento NestJS y que StockViandas lo escuche — rechazado por overhead de complejidad innecesario en un monolito sincrónico
- Mover `generarDesdeProduccion` a `ProduccionViandasService` — rechazado porque viola separación de responsabilidades (el stock es responsabilidad de `stock-viandas`)

**Nota**: Mientras `StockViandasModule` no exista, `ProduccionViandasModule` no compilará si importa `forwardRef(() => StockViandasModule)`. Se puede posponer esa importación y hacer el service opcional hasta que stock-viandas sea implementado.

---

## Decisión 4: Campos del menú publicado para identificar "activos del día"

**Decision**: Filtrar menús publicados por `fecha_publicacion = dto.fecha_produccion` y `estado IN ('publicado', 'activo')` (pending verificación de valores exactos del enum `EstadoMenuPublicado` durante implementación).

**Rationale**: El módulo de menús-publicados define los menús disponibles para una fecha. Solo los menús en estado activo/publicado deben generar órdenes de producción.

**Alternatives considered**:
- Filtrar solo por `estado = 'activo'` — podría excluir menús recién publicados si hay diferencia entre ambos estados; usar ambos es más robusto
- Usar `MenusPublicadosService.findActivos()` — evitado para no crear dependencia de servicio (solo se usa el repositorio directamente)

---

## Decisión 5: Vista imprimible sin paginación

**Decision**: `getImprimible()` retorna todos los registros del filtro sin paginación, con un conjunto reducido de campos (fecha, sede.nombre, puntoRetiro.nombre, menuPublicado.menuBase.nombre, total_sugerido, estado).

**Rationale**: La hoja de producción de cocina se imprime completa para una fecha/turno dado. Paginar no tiene sentido operativo en este contexto. El volumen máximo esperable es bajo (pocas decenas de órdenes por día por sede).

**Alternatives considered**:
- Paginación opcional via query param — innecesario dado el volumen; añade complejidad sin valor

---

## Decisión 6: Alerta "producción < encargues" no bloquea

**Decision**: La alerta se incluye en el campo `alerta` de la respuesta del endpoint `POST /:id/confirmar`. No lanza error ni rollback. El frontoffice decide cómo mostrarla.

**Rationale**: El spec es explícito: "no bloquea, solo informa". Bloquear generaría un estado inconsistente (la orden queda en `en_produccion` sin poder confirmar si hay faltante inevitable). La cocina puede producir menos si hay insumos insuficientes y debe poder registrarlo con observación.

---

## Campos existentes confirmados

| Campo | Entidad | Valor exacto |
|---|---|---|
| Estado pedido online confirmado | `EstadoPedido` | `confirmado_pago_online` |
| Estado pedido presencial confirmado | `EstadoPedido` | `confirmado_pago_presencial` |
| Estado pedido cancelado | `EstadoPedido` | `cancelado` |
| Tipo sobreproducción fija | `TipoSobreproduccion` | `cantidad_fija` |
| Tipo sobreproducción porcentaje | `TipoSobreproduccion` | `porcentaje` |
| Campo valor sobreproducción | `MenuPublicado` | `valor_sobreproduccion` (decimal 8,2 nullable) |
| Campo tipo sobreproducción | `MenuPublicado` | `tipo_sobreproduccion` (enum nullable) |
