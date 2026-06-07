# Feature Specification: Pagos (Registro y Gestión de Pagos de Pedidos)

**Feature Branch**: `012-pagos`

**Created**: 2026-06-07

**Status**: Draft

**Input**: Módulo de soporte que gestiona el registro de pagos asociados a pedidos de viandas, tanto online (Mercado Pago) como presenciales.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar Pago de un Pedido desde Back Office (Priority: P1)

Un operador de caja, supervisor o administrador necesita verificar el estado del pago de un pedido específico. Ingresa al back office y consulta el registro de pago asociado al pedido por su ID.

**Why this priority**: Es la única interacción directa con este módulo desde el back office. Las demás operaciones son internas. Sin esta capacidad, el equipo operativo no puede diagnosticar problemas de cobro ni confirmar el estado financiero de un pedido.

**Independent Test**: Puede probarse con un GET a `/admin/pagos/:pedidoId` con un JWT válido de cualquier rol habilitado, verificando que devuelve el registro de pago con todos sus campos.

**Acceptance Scenarios**:

1. **Given** un pedido con pago registrado, **When** un usuario con rol `administrador`, `supervisor` u `operador_caja` consulta `/admin/pagos/:pedidoId`, **Then** el sistema retorna el registro de pago con estado, importe, medio de pago y timestamps correspondientes.
2. **Given** un pedido sin pago registrado o con ID inválido, **When** el usuario consulta el pago, **Then** el sistema retorna un error de recurso no encontrado.
3. **Given** un usuario sin rol habilitado, **When** intenta consultar el pago, **Then** el sistema rechaza la solicitud con error de autorización.
4. **Given** un pago perteneciente a otro tenant, **When** el usuario consulta por el pedido_id, **Then** el sistema no devuelve datos (scope de tenant aplicado).

---

### User Story 2 - Registro Automático de Pago al Crear Pedido (Priority: P2)

Cuando un cliente crea un pedido desde el portal (presencial u online), el sistema registra automáticamente el pago correspondiente sin intervención del usuario. El registro refleja el medio de pago y el importe del pedido.

**Why this priority**: Es el flujo de creación principal — sin el registro automático del pago no hay trazabilidad financiera de los pedidos. Depende de US1 para verificación.

**Independent Test**: Puede verificarse creando un pedido presencial y luego consultando `GET /admin/pagos/:pedidoId` — el sistema debe retornar un registro con `estado: presencial_pendiente` y el importe correcto. Para pedidos online: `estado: pendiente`.

**Acceptance Scenarios**:

1. **Given** un pedido presencial creado exitosamente, **When** el sistema procesa la creación, **Then** se registra automáticamente un pago con `estado: presencial_pendiente` y el importe del pedido.
2. **Given** un pedido online creado exitosamente, **When** el sistema procesa la creación, **Then** se registra automáticamente un pago con `estado: pendiente` y el importe del pedido.
3. **Given** un pedido con un pago ya registrado, **When** se intenta registrar un segundo pago para el mismo pedido, **Then** el sistema rechaza la operación (un pedido tiene máximo un pago).
4. **Given** que la creación del registro de pago falla, **When** ocurre el error, **Then** la creación del pedido también se revierte (operación atómica).

---

### User Story 3 - Cancelación de Pago al Cancelar Pedido (Priority: P3)

Cuando un pedido es cancelado (desde portal o desde admin), el sistema marca automáticamente el pago asociado como cancelado, reflejando el cambio de estado financiero.

**Why this priority**: Mantiene la consistencia entre el estado del pedido y el estado del pago. Es requisito para que las cancelaciones del módulo de pedidos sean completas.

**Independent Test**: Puede verificarse cancelando un pedido y luego consultando `GET /admin/pagos/:pedidoId` — el pago debe tener `estado: cancelado`.

**Acceptance Scenarios**:

1. **Given** un pedido con pago `presencial_pendiente` que se cancela, **When** el sistema procesa la cancelación, **Then** el pago pasa a `estado: cancelado`.
2. **Given** un pedido con pago `pendiente` (online) que se cancela, **When** el sistema procesa la cancelación, **Then** el pago pasa a `estado: cancelado`.
3. **Given** un pedido con pago `aprobado` que se cancela, **When** el sistema procesa la cancelación, **Then** el pago pasa a `estado: cancelado` y el pedido registra que hay una devolución pendiente.

---

### User Story 4 - Registro de Cobro Presencial (Priority: P4)

Cuando un operador registra la entrega de un pedido presencial y el cobro correspondiente, el sistema actualiza el estado del pago a cobrado y registra el momento del cobro.

**Why this priority**: Cierra el ciclo de cobro presencial. Depende de Stage 5 (entregas) para su integración completa.

**Independent Test**: Puede simularse llamando al método `registrarCobroPresencial` del servicio con un pedido con pago en `presencial_pendiente`, verificando que el pago pasa a `presencial_cobrado` con `fecha_registro_presencial` seteada.

**Acceptance Scenarios**:

1. **Given** un pago en estado `presencial_pendiente`, **When** se registra el cobro presencial, **Then** el pago pasa a `estado: presencial_cobrado` y se registra la fecha y hora del cobro.
2. **Given** un pago ya en estado `presencial_cobrado`, **When** se intenta registrar el cobro nuevamente, **Then** el sistema rechaza la operación (pago ya cobrado).
3. **Given** un pago en estado `cancelado`, **When** se intenta registrar el cobro, **Then** el sistema rechaza la operación.

---

### User Story 5 - Actualización de Estado por Confirmación Online (Priority: P5)

Cuando Mercado Pago confirma o rechaza un pago online mediante webhook, el sistema actualiza el estado del pago y registra la referencia externa (ID de operación de MP) y la fecha de aprobación si aplica.

**Why this priority**: Stage 4 (Mercado Pago). El módulo de pagos debe estar preparado para recibir estas actualizaciones aunque el webhook de MP se implemente más adelante.

**Independent Test**: Puede simularse llamando al método `actualizarEstadoOnline` con un pedido con pago en `pendiente`, verificando que el estado se actualiza correctamente y se persiste la referencia externa.

**Acceptance Scenarios**:

1. **Given** un pago online en `estado: pendiente`, **When** Mercado Pago confirma el pago, **Then** el estado pasa a `aprobado`, se registra la referencia externa y la fecha de aprobación.
2. **Given** un pago online en `estado: pendiente`, **When** Mercado Pago rechaza el pago, **Then** el estado pasa a `rechazado`.
3. **Given** un pago con referencia externa ya registrada, **When** llega una actualización duplicada con la misma referencia, **Then** el sistema actualiza el estado sin crear un registro duplicado (idempotente).

---

### Edge Cases

- ¿Qué ocurre si se intenta registrar un pago para un pedido que ya tiene uno? → El sistema rechaza la operación; un pedido tiene máximo un pago (unicidad por `pedido_id`).
- ¿Qué ocurre si el importe informado al registrar el pago no coincide con el del pedido? → El importe del pago siempre viene del pedido al momento de la creación; no se recalcula ni se sobreescribe.
- ¿Qué ocurre si se intenta cancelar un pago ya aprobado directamente? → Solo se puede marcar como cancelado en el contexto de la cancelación del pedido completo; la decisión de devolución queda en el módulo de pedidos.
- ¿Qué ocurre si el registro de pago falla al crear un pedido? → La operación de creación del pedido se revierte completamente (atomicidad).
- ¿Qué ocurre si se intenta cobrar un pago de un pedido cancelado? → El sistema rechaza la operación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE registrar automáticamente un pago al crear un pedido presencial, con estado `presencial_pendiente` y el importe del pedido.
- **FR-002**: El sistema DEBE registrar automáticamente un pago al crear un pedido online, con estado `pendiente` y el importe del pedido.
- **FR-003**: El sistema DEBE garantizar que cada pedido tenga como máximo un pago registrado.
- **FR-004**: El sistema DEBE permitir actualizar el estado del pago online cuando el proveedor externo confirma o rechaza la transacción, registrando la referencia externa y la fecha de aprobación.
- **FR-005**: El sistema DEBE permitir registrar el cobro presencial, actualizando el estado a cobrado y registrando la fecha y hora del cobro.
- **FR-006**: El sistema DEBE rechazar el registro de cobro presencial si el pago ya fue cobrado.
- **FR-007**: El sistema DEBE marcar el pago como cancelado cuando el pedido asociado es cancelado.
- **FR-008**: El sistema DEBE permitir consultar el pago de un pedido desde el back office, con control de acceso por roles.
- **FR-009**: El sistema DEBE aplicar scope de tenant en todas las consultas — ningún pago de un tenant es accesible desde otro tenant.
- **FR-010**: El sistema DEBE registrar la fecha y hora de generación del pago al momento de su creación.

### Key Entities

- **Pago**: Registro financiero asociado a un pedido. Atributos clave: pedido de referencia, medio de pago, estado actual, importe, referencia externa del proveedor de pagos, fecha de generación, fecha de aprobación, fecha de cobro presencial.
- **EstadoPago**: `pendiente` (online esperando confirmación), `aprobado` (MP confirmó), `rechazado` (MP rechazó), `cancelado` (pedido cancelado), `presencial_pendiente` (cobro presencial pendiente al momento de la entrega), `presencial_cobrado` (operador registró el cobro).
- **MedioPago**: `mercado_pago` (pago online) o `presencial` (cobro en el momento de retiro).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cada pedido creado exitosamente tiene un registro de pago generado automáticamente con el estado inicial correcto según su medio de pago — 100% de los pedidos creados tienen pago asociado.
- **SC-002**: Ningún pedido tiene más de un registro de pago — 0 registros duplicados de pago por pedido.
- **SC-003**: El estado del pago se mantiene coherente con el estado del pedido — al cancelar un pedido, el pago queda en `cancelado` en el 100% de los casos.
- **SC-004**: El equipo back-office puede consultar el estado de pago de cualquier pedido de su tenant sin necesidad de acceder directamente a la base de datos.
- **SC-005**: La actualización del estado de pago online (aprobado/rechazado) es idempotente — múltiples llamadas con la misma referencia externa no generan inconsistencias.

## Assumptions

- Este módulo es un servicio de soporte — no expone endpoints públicos para clientes del portal.
- El único endpoint HTTP es `GET /admin/pagos/:pedidoId` para consulta desde el back office.
- La integración completa con Mercado Pago (webhook) se implementa en Stage 4; este módulo provee la infraestructura de datos pero el flujo de confirmación automática no está activo en Stage 3.
- El registro de cobro presencial se integra en Stage 5 (entregas); el método `registrarCobroPresencial` está disponible pero no se llama desde ningún endpoint hasta entonces.
- El importe del pago se toma directamente del `importe_total` del pedido al momento de su creación; no se permite modificar el importe después.
- No se requiere auditoría directa desde este módulo — los módulos que invocan los métodos de este servicio (pedidos, entregas, mercado-pago) son responsables de registrar sus propios eventos de auditoría.
- `PedidosModule` no es importado por `PagosModule` (evitar inyección circular) — la FK `pedido_id` es solo una referencia de columna.
- Todos los métodos internos del servicio son llamados dentro del contexto de tenancy del request originador.
