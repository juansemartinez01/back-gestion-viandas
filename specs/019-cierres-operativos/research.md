# Research: Cierres Operativos

## 1. Patrón transaccional con QueryRunner (SELECT FOR UPDATE)

**Decision**: Usar `DataSource.createQueryRunner()` con `qr.startTransaction()` para el flujo de cierre, igual que en `ventas-sobrantes` y `entregas`.

**Rationale**: El cierre necesita actualizar múltiples pedidos atomicamente y crear el registro de cierre en una sola transacción. QueryRunner es el patrón establecido en el proyecto para operaciones transaccionales complejas con `SELECT FOR UPDATE`.

**Alternatives considered**: `DataSource.transaction(cb)` — descartado porque el proyecto usa consistentemente QueryRunner para tener control explícito del commit/rollback y poder hacer SELECT FOR UPDATE sobre múltiples entidades.

---

## 2. Estados de pedido elegibles para no_retirado

**Decision**: Solo pedidos con estado `CONFIRMADO_PAGO_ONLINE` o `CONFIRMADO_PAGO_PRESENCIAL` son marcados como `no_retirado`.

**Rationale**: `pendiente_pago_online` no representa un compromiso real de retiro — la reserva ya expiró. `cancelado` está explícitamente excluido. `entregado` y `no_retirado` ya son estados terminales. Solo los estados `confirmado_*` representan pedidos reales confirmados que no fueron retirados.

**Alternatives considered**: Incluir `pendiente_pago_online` — descartado por regla de negocio explícita. Estos pedidos ya tuvieron su reserva liberada automáticamente.

---

## 3. isDiaCerrado como método del servicio exportado

**Decision**: Implementar `isDiaCerrado(fecha, sedeId, puntoRetiroId, tenantId): Promise<boolean>` usando una consulta simple `findOne` o `count` sobre el índice `(tenant_id, fecha_operativa, sede_id)`.

**Rationale**: `EntregasService` y `VentasSobrantesService` necesitan llamar a este método antes de procesar cualquier operación del día. La consulta debe ser eficiente (usa el índice compuesto existente). Acepta `tenantId` como parámetro porque se llama desde servicios que pueden no tener el contexto de tenancy inyectado directamente en el momento de la llamada.

**Alternatives considered**: Emitir un evento de dominio al cerrar el día y que los otros módulos mantengan una cache local — descartado por complejidad innecesaria. Una consulta directa es suficiente y más simple.

---

## 4. Cálculo de recaudación presencial

**Decision**: Recaudación = `SUM(ep.importe_cobrado_caja)` de `entrega_pedidos` del día/sede/punto + `SUM(vs.importe_total)` de `ventas_sobrantes` del día/sede/punto.

**Rationale**: `EntregaPedido.importe_cobrado_caja` ya almacena el monto cobrado en efectivo para entregas presenciales (y es 0 para online). `VentaSobrante.importe_total` es siempre efectivo. La suma de ambos da la recaudación presencial exacta del día.

**Alternatives considered**: Sumar solo los pedidos con `MedioPagoPedido.PRESENCIAL` — innecesario porque `importe_cobrado_caja` ya es 0 para online, por lo que la suma es equivalente.

---

## 5. Orden de endpoints en el controller (resumen-previo antes de /:id)

**Decision**: Definir `GET /resumen-previo` antes de `GET /:id` en el controller.

**Rationale**: En NestJS, las rutas se evalúan en orden de declaración. Si `GET /:id` se define primero, una petición a `/resumen-previo` sería interpretada como `/:id` con `id = "resumen-previo"`, provocando un error 404 o comportamiento incorrecto.

**Alternatives considered**: Usar un path diferente como `/preview` — innecesario, el orden de declaración resuelve el problema de forma limpia.

---

## 6. Unicidad del cierre y manejo de concurrencia

**Decision**: La unicidad se garantiza en dos capas: (a) verificación explícita al inicio de la transacción con `findOne`, y (b) constraint `UNIQUE` en la base de datos como red de seguridad.

**Rationale**: La verificación explícita da un error de negocio descriptivo (`CIERRE_YA_EXISTE`). El constraint de base de datos previene condiciones de carrera entre dos transacciones concurrentes que pasen la verificación simultáneamente — la BD rechaza la segunda inserción.

**Alternatives considered**: Solo confiar en el constraint de BD — descartado porque el error de integridad de PostgreSQL no se traduce automáticamente al error de negocio `CIERRE_YA_EXISTE`.

---

## 7. Relación con EntregasModule y VentasSobrantesModule

**Decision**: `CierresOperativosModule` importa `PedidosModule`, `EntregasModule`, y `VentasSobrantesModule` solo para acceder a sus repositorios vía `TypeOrmModule.forFeature`. No inyecta sus servicios directamente para evitar dependencias circulares.

**Rationale**: El módulo necesita leer datos de `entrega_pedidos` y `ventas_sobrantes`, pero esos módulos no dependen de `CierresOperativosModule`. La dirección de la dependencia es unidireccional: cierres → entregas/ventas, no circular.

**Alternatives considered**: Inyectar `EntregasService` y `VentasSobrantesService` — descartado porque causaría dependencia circular si esos servicios inyectan `CierresOperativosService` para validar el día cerrado.
