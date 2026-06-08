# Research: Entregas de Viandas

**Feature**: 017-entregas | **Date**: 2026-06-08

## Decision 1: Estrategia transaccional — QueryRunner vs DataSource.transaction()

**Decision**: Usar `QueryRunner` (patrón `qr.connect() / qr.startTransaction() / qr.commitTransaction() / qr.rollbackTransaction()`) igual que `PedidosService._crearPedidoCore()`.

**Rationale**: El patrón QueryRunner permite pasar el `qr` a métodos que lo aceptan (e.g., `PagosService.crearPagoPresencial`). Para operaciones críticas como la actualización del `Pago` (cobro presencial) y la creación del `EntregaPedido`, se usa `qr.manager` directamente — garantizando que ambas mutaciones ocurren en la misma conexión de base de datos y hacen rollback juntas si algo falla.

**Alternatives considered**: `DataSource.transaction(async (em) => {...})` — descartado porque no permite pasar el EntityManager a servicios externos que abren sus propias transacciones, y porque algunos servicios (PagosService.registrarCobroPresencial) no aceptan EntityManager.

---

## Decision 2: Cobro presencial — PagosService vs inline via qr.manager

**Decision**: NO llamar a `PagosService.registrarCobroPresencial(pedidoId)` desde dentro de la transacción. En cambio, actualizar el `Pago` inline usando `qr.manager.getRepository(Pago)` dentro del mismo QueryRunner.

**Rationale**: `PagosService.registrarCobroPresencial(pedidoId)` firma actual: `(pedidoId: string): Promise<Pago>`. No acepta QueryRunner ni EntityManager. Usa `this.pagoRepo.save(pago)` que opera en una conexión del pool, fuera de la transacción del QueryRunner. Para mantener atomicidad total (EntregaPedido + actualización Pago + estado Pedido en el mismo rollback scope), la actualización del pago debe ocurrir via `qr.manager`.

**Implementation**: Dentro de la transacción:
```
const pago = await qr.manager.getRepository(Pago)
  .createQueryBuilder('p')
  .where('p.pedido_id = :pedidoId', { pedidoId })
  .andWhere('p.tenant_id = :tenantId', { tenantId })
  .getOne();

if (!pago || pago.estado !== EstadoPago.PRESENCIAL_PENDIENTE) {
  throw new AppError({ code: ErrorCodes.PAGO_NOT_FOUND, ... });
}

pago.estado = EstadoPago.PRESENCIAL_COBRADO;
pago.fecha_registro_presencial = new Date();
await qr.manager.getRepository(Pago).save(pago);
importe_cobrado_caja = pago.importe;
```

**Alternatives considered**: Llamar a `PagosService.registrarCobroPresencial()` fuera del try/commit — descartado porque si el QueryRunner commit falla después del cobro, el pago queda marcado como cobrado sin entrega registrada (inconsistencia permanente).

---

## Decision 3: Consumo de stock — consumirParaEntrega y aislamiento transaccional

**Decision**: Llamar a `StockViandasService.consumirParaEntrega(stockId, cantidad, pedidoId, tenantId)` dentro del bloque `try` del QueryRunner, antes del `qr.commitTransaction()`.

**Rationale**: `consumirParaEntrega` abre su propia `DataSource.transaction()` interna, lo que implica una **conexión separada del pool** (no la misma que el QueryRunner). Esto significa que el consumo de stock **no está en el mismo scope transaccional** que la creación del EntregaPedido.

**Trade-off aceptado**: Si `consumirParaEntrega` tiene éxito pero el `qr.commitTransaction()` falla después, el stock quedará decrementado sin un `EntregaPedido` correspondiente. Este es el único punto de inconsistencia posible.

**Mitigación**: Esta ventana de inconsistencia es extremadamente pequeña (entre el éxito de `consumirParaEntrega` y el commit del QR). La verificación de idempotencia al inicio del flujo (paso 3) garantiza que no se puede intentar la entrega dos veces para el mismo pedido — lo que evita el re-consumo de stock. El `SELECT FOR UPDATE` en el pedido evita concurrencia sobre el mismo pedido.

**Alternativa rechazada**: Agregar un método `consumirParaEntregaConEm(em, stockId, cantidad, pedidoId, tenantId)` a `StockViandasService` que acepte un EntityManager. Sería la solución correcta para atomicidad total pero implica modificar una interfaz pública de un módulo ya implementado y testeado. Decisión: documentar el trade-off y aceptarlo dado el bajo volumen y la protección por idempotencia.

---

## Decision 4: SELECT FOR UPDATE en el Pedido

**Decision**: Usar QueryBuilder con `.setLock('pessimistic_write')` sobre el Pedido al inicio de la transacción, antes de cualquier validación de estado.

**Rationale**: Evita que dos requests simultáneos para el mismo pedido pasen la verificación de idempotencia al mismo tiempo. Primero se bloquea el registro del pedido, luego se lee su estado. El orden es: LOCK → validar estado → verificar idempotencia → consumir stock → crear entrega.

**Implementation**:
```
const pedido = await qr.manager
  .getRepository(Pedido)
  .createQueryBuilder('p')
  .setLock('pessimistic_write')
  .where('p.id = :id', { id: dto.pedido_id })
  .andWhere('p.tenant_id = :tenantId', { tenantId })
  .getOne();
```

---

## Decision 5: Lookup de StockVianda para la entrega

**Decision**: Buscar StockVianda por `(tenant_id, fecha=pedido.fecha_retiro, sede_id, punto_retiro_id, menu_publicado_id)`. Usar `pedido.fecha_retiro` (no `fecha_pedido`) porque el stock está organizado por fecha de producción/retiro.

**Rationale**: Los campos `sede_id`, `punto_retiro_id` y `menu_publicado_id` del stock se obtienen directamente del Pedido. No es necesario que el cliente de la API los envíe en el DTO de crear entrega.

**Implementation**: La sede y punto de retiro de la entrega se toman del pedido (no del DTO). El DTO de crear entrega solo requiere `pedido_id`, `punto_retiro_id` (para registrar dónde ocurrió físicamente) y `observacion` opcional.

**Nota**: En la entidad `EntregaPedido`, `sede_id` y `punto_retiro_id` se toman del pedido resuelto, no del DTO.

---

## Decision 6: BuscarPorDni — campo dni_informado con ILIKE

**Decision**: La búsqueda por DNI usa `pedido.dni_informado ILIKE :dni` para ser case-insensitive y tolerante a formatos mixtos.

**Rationale**: El campo `dni_informado` en Pedido es `varchar(20)`. El DNI puede ingresarse con variaciones de formato (espacios, puntos). ILIKE garantiza que `12345678` y `12.345.678` no son iguales pero tampoco sensibles a mayúsculas. El operador puede buscar con coincidencia exacta o parcial.

**Filtering**: La búsqueda siempre requiere `fecha` + `sede_id`. `punto_retiro_id` es opcional — si viene, se filtra; si no, muestra todos los puntos de la sede para ese día.

---

## Decision 7: EntregaPedido — sin soft delete, sin updated_at

**Decision**: La entidad `EntregaPedido` no tiene `deleted_at` ni `updated_at`. Las entregas son inmutables una vez creadas.

**Rationale**: Una entrega registrada representa un evento histórico en el tiempo real. No puede modificarse ni eliminarse. Si hay un error, se resuelve mediante un proceso administrativo fuera del sistema (o una cancelación del pedido a nivel superior). El índice compuesto `(tenant_id, fecha_entrega, sede_id)` cubre los filtros de listado más comunes.

---

## Decision 8: Module imports — forwardRef no necesario

**Decision**: `EntregasModule` importa `PedidosModule`, `PagosModule`, `StockViandasModule` directamente sin `forwardRef`. También declara `TypeOrmModule.forFeature([EntregaPedido, Pedido, StockVianda])` para acceso directo a repos en consultas de lectura.

**Rationale**: No hay dependencia circular — `entregas` depende de pedidos/pagos/stock pero ninguno de ellos depende de `entregas`. `forwardRef` solo fue necesario en pedidos↔mercado-pago y pedidos↔stock-viandas porque esos módulos se llaman mutuamente.

**Nota**: `Pago` también se necesita en el service (para la actualización inline del cobro). Se agrega `Pago` a `TypeOrmModule.forFeature` o se importa via `PagosModule`. Dado que el `PagosModule` exporta `PagosService` pero no re-exporta su TypeORM feature, se agrega `Pago` directamente al `forFeature` de `EntregasModule`.

---

## Decision 9: Endpoint order — /buscar-por-dni antes de /:id

**Decision**: En el controller, `@Get('buscar-por-dni')` se declara **antes** de `@Get(':id')`.

**Rationale**: NestJS resuelve rutas en orden de declaración. Si `/:id` aparece primero, la cadena `buscar-por-dni` sería interpretada como un UUID inválido, causando un error 400 o 404 antes de llegar al handler correcto.

---

## Interfaces de servicios dependientes confirmadas

### PagosService
- `registrarCobroPresencial(pedidoId: string): Promise<Pago>` — NO usar; replicar inline via qr.manager
- `crearPagoPresencial(pedidoId, importe, tenantId, qr)` — no aplica aquí (el pago ya existe)

### StockViandasService
- `consumirParaEntrega(stockViandaId: string, cantidad: number, pedidoId: string, tenantId: string): Promise<void>` — llamar con los 4 args
- Maneja `STOCK_INSUFICIENTE_ENTREGAS` (409) internamente — no re-catchear en EntregasService

### Pedido entity campos relevantes
- `fecha_retiro: string` (date) — usar para lookup de stock
- `medio_pago: MedioPagoPedido` (MERCADO_PAGO | PRESENCIAL) — ramifica el flujo de cobro
- `estado_pedido: EstadoPedido` — estados elegibles: CONFIRMADO_PAGO_ONLINE, CONFIRMADO_PAGO_PRESENCIAL
- `importe_total: number` — para registrar en `importe_cobrado_caja`
- `cantidad: number` — para consumo de stock
- `sede_id`, `punto_retiro_id`, `menu_publicado_id` — para lookup de stock

### ErrorCodes existentes (no duplicar)
- `STOCK_INSUFICIENTE_ENTREGAS` — lanzado por `consumirParaEntrega`, no crear uno nuevo
- `PAGO_NOT_FOUND` — reutilizar si el pago presencial no existe
- `PEDIDO_NOT_FOUND` — reutilizar si el pedido no existe

### ErrorCodes nuevos a agregar
- `ENTREGA_PEDIDO_NO_ENTREGABLE` (409) — pedido en estado inválido para entrega
- `ENTREGA_YA_REGISTRADA` (409) — ya existe EntregaPedido para este pedido
- `ENTREGA_NOT_FOUND` (404) — entrega no encontrada por id
