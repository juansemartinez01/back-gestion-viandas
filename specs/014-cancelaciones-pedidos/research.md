# Research: Módulo Cancelaciones de Pedidos

## Decision 1: Campo devolucion_pendiente en Pedido

**Decision**: El campo `devolucion_pendiente: boolean` (default: `false`) ya existe en la entidad `Pedido`.
**Rationale**: No se necesita ninguna migración ni campo adicional. La query de devoluciones pendientes filtra directamente por `devolucion_pendiente = true AND estado_pedido = cancelado`.
**Alternatives considered**: Calcular en tiempo de ejecución combinando `metodo_pago + estado_pago`; descartado porque el campo explícito ya existe y es más eficiente.

---

## Decision 2: OrigenCancelacion enum

**Decision**: El enum `OrigenCancelacion` ya existe en `src/modules/pedidos/pedido.enums.ts` con valores `CLIENTE = 'cliente'` y `ADMINISTRACION = 'administracion'`.
**Rationale**: Importar directamente desde `pedido.enums.ts`. No crear un enum duplicado.
**Alternatives considered**: Crear enum propio en el módulo cancelaciones; descartado para evitar duplicación.

---

## Decision 3: Estrategia de imports del módulo — sin PedidosModule

**Decision**: `CancelacionesPedidosModule` NO importa `PedidosModule`. Usa `TypeOrmModule.forFeature([Pedido])` directamente para obtener `Repository<Pedido>`. No importa `MenusPublicadosModule`.
**Rationale**: 
- `validarReglaCancelacionPortal` recibe `menuPublicado` como parámetro — no necesita inyectar `MenusPublicadosService`.
- Importar `PedidosModule` solo para acceder al tipo `Pedido` no es necesario; TypeORM permite registrar la entidad en múltiples módulos.
- Esto elimina cualquier riesgo de dependencia circular futura si `PedidosModule` eventualmente importa `CancelacionesPedidosService` para validación.
**Alternatives considered**: Importar `PedidosModule` y usar `PedidosService`; descartado porque `PedidosService` no tiene métodos de solo lectura que coincidan con las queries necesarias y agregaría acoplamiento innecesario.

---

## Decision 4: campo fecha_hora_limite_cancelacion en MenuPublicado

**Decision**: El campo `fecha_hora_limite_cancelacion: Date | null` (timestamptz, nullable) ya existe en `MenuPublicado`.
**Rationale**: La lógica de `validarReglaCancelacionPortal` puede comparar directamente `new Date() > menuPublicado.fecha_hora_limite_cancelacion`. Si el campo es `null`, no hay ventana de cancelación disponible → `permitido: false`.
**Alternatives considered**: N/A; el campo ya existe tal como se necesita.

---

## Decision 5: PageQueryDto

**Decision**: `QueryCancelacionesDto` extiende `PageQueryDto` ubicada en `src/common/query/page-query.dto.ts`. Misma estructura que `QueryPedidoDto`.
**Rationale**: Consistencia con el patrón del proyecto. `PageQueryDto` provee `page` (default: 1) y `limit` (default: 20, max: 200).
**Alternatives considered**: N/A; patrón estándar del template.

---

## Decision 6: No TenancyModule directo — usar TenancyService

**Decision**: Inyectar `TenancyService` directamente en `CancelacionesPedidosService` para obtener `tenant_id` en cada query. Verificado que `TenancyModule` está disponible como módulo global.
**Rationale**: Todos los módulos Type C del proyecto usan este patrón. Garantiza que ninguna query escape del scope del tenant.
**Alternatives considered**: N/A; patrón estándar del template.

---

## Decision 7: Enum valores para validarReglaCancelacionPortal

**Decision**: Los estados que bloquean cancelación desde el portal son: `ENTREGADO`, `CANCELADO`, `NO_RETIRADO`, `PENDIENTE_PAGO_ONLINE`, `CONFIRMADO_PAGO_ONLINE`. Solo `CONFIRMADO_PAGO_PRESENCIAL` dentro de plazo está permitido.

**Rationale**:
- `ENTREGADO` → ya recibido, no reversible.
- `CANCELADO` → ya está cancelado.
- `NO_RETIRADO` → operación del día ya cerrada.
- `PENDIENTE_PAGO_ONLINE` / `CONFIRMADO_PAGO_ONLINE` → flujo de pago en curso; cancelación requiere intervención de administración para coordinar con Mercado Pago.
- `CONFIRMADO_PAGO_PRESENCIAL` → único estado donde el cliente puede cancelar si está dentro del plazo.

**Alternatives considered**: Permitir cancelación de `CONFIRMADO_PAGO_ONLINE` desde el portal; descartado porque implica reversión de pago automática que aún no está implementada.
