# Research: Pedidos Module

**Feature**: 011-pedidos | **Date**: 2026-06-07

## Resolved Decisions

### 1. ScheduleModule — ¿Está ya registrado en AppModule?

- **Decision**: No agregar `ScheduleModule.forRoot()` en `AppModule` ni en `PedidosModule`.
- **Rationale**: `AuditModule` ya importa `ScheduleModule.forRoot()` y es importado por `AppModule`. NestJS registra `ScheduleModule` globalmente con `forRoot()` — una sola instancia es suficiente.
- **Alternatives considered**: Agregar `ScheduleModule.forRoot()` en `PedidosModule` — rechazado porque causaría conflicto de registro duplicado.

### 2. Control de concurrencia para `limite_maximo_viandas`

- **Decision**: Usar `QueryRunner` con `SELECT ... FOR UPDATE` dentro de la misma transacción en la que se crea el pedido.
- **Rationale**: Evita race condition donde dos requests simultáneos leen el mismo contador antes de incrementar, y ambos validan OK pero superan el límite. `SELECT FOR UPDATE` serializa las validaciones del mismo tenant+menú.
- **Alternatives considered**: Optimistic locking (`@Version`) — rechazado porque requiere retry logic en el caller y la semántica del error sería confusa para el cliente. Contador en tabla separada — sobreingeniería para el volumen esperado.
- **Pattern**: `DataSource.createQueryRunner()` → `connect()` → `startTransaction()` → `SELECT COUNT(*) ... FOR UPDATE` → `INSERT` → `commitTransaction()`.

### 3. Generación de `codigo_publico` — atomicidad

- **Decision**: Generar dentro de la misma transacción del `crearPedido`, usando `SELECT MAX(codigo_publico) FROM pedidos WHERE tenant_id = :tid AND codigo_publico LIKE 'VIA-{año}-%' FOR UPDATE`.
- **Rationale**: El `FOR UPDATE` sobre los pedidos existentes del año actúa como lock de secuencia, impidiendo que dos transacciones simultáneas lean el mismo MAX y generen el mismo código.
- **Alternatives considered**: Sequence PostgreSQL — requeriría una sequence por tenant×año (no escalable). UUID como código público — rechazado por UX (el cliente necesita un código legible).

### 4. Precio en `UpdatePedidoDto` — inmutabilidad

- **Decision**: `UpdatePedidoDto` no incluye `precio_unitario` ni `importe_total`. El service tampoco acepta esos campos aunque vengan en el body (class-transformer `excludeExtraneousValues`).
- **Rationale**: Invariante de negocio crítica (SC-003). Si el DTO no tiene el campo, TypeScript garantiza en tiempo de compilación que nunca se asignará.

### 5. Tenant resolution en endpoints públicos

- **Decision**: El middleware `TenancyMiddleware` existente resuelve el tenant desde el header `x-tenant-key` antes de que llegue al controller. `PedidosService` puede llamar `this.getTenantId({ strictTenant: true })` en todos sus métodos.
- **Rationale**: Patrón ya establecido en `MenusPublicadosService.listDisponiblesPublic()`. Sin cambios en el middleware.
- **Alternatives considered**: Pasar `tenantId` como parámetro explícito desde el controller — rechazado, inconsistente con el patrón del proyecto.

### 6. `PedidosModule` — imports y providers

- **Decision**:
  - `TypeOrmModule.forFeature([Pedido])` — solo la entidad propia. `MenuPublicado` y `PuntoRetiro` se acceden a través de sus servicios (no repository directo).
  - Imports: `ClientesModule`, `MenusPublicadosModule`, `SedesModule`, `PuntosRetiroModule`, `AuditModule`.
  - `DataSource` se inyecta directamente en `PedidosService` para manejar transacciones con `QueryRunner`.
- **Rationale**: Acceder a repositorios de otros módulos violaría el encapsulamiento. Los servicios ya exponen los métodos necesarios (`MenusPublicadosService.findOne`, `ClientesService.upsertByDni`). Los JOIN para el `findOne` del pedido se hacen sobre `menu_publicado_id`, `sede_id`, `punto_retiro_id` como columnas simples (FK), sin necesitar los repos en el módulo.
- **Alternatives considered**: `TypeOrmModule.forFeature([Pedido, MenuPublicado, PuntoRetiro])` — puede causar confusión sobre cuál módulo es "dueño" de la entidad y crea acoplamiento innecesario.

### 7. `AuditKind` — valor correcto para pedidos

- **Decision**: Usar `'admin'` como `kind` para auditorías de pedidos administrativos (mismo patrón que `menus-publicados.controller.ts`).
- **Rationale**: El enum `AuditKind` en el proyecto incluye `'admin'` para acciones del back-office.

### 8. `UpsertClienteDto` — campos requeridos

- **Decision**: `ClientesService.upsertByDni()` acepta `{ dni, nombre, apellido, telefono?, email? }`. El DTO del pedido usa los mismos nombres para los campos del cliente informado.
- **Rationale**: Revisado el código de `clientes.service.ts` — el método `upsertByDni` toma `UpsertClienteDto` con esos campos exactos.

### 9. `cancelarDesdePortal` — identificación del pedido sin autenticación

- **Decision**: El endpoint público `POST /public/pedidos/:id/cancelar` recibe el UUID interno del pedido como `id`. El portal debe haberlo guardado al momento de crear el pedido.
- **Rationale**: No hay sesión de usuario en el portal. El UUID no es adivinable. Alternativa de verificar por DNI+id está implícita en el scope del tenant.
- **Alternatives considered**: Usar `codigo_publico` como identificador — cambiaría la especificación del endpoint; queda documentado como posible mejora.

### 10. Job de expiración — scope de tenant

- **Decision**: El job itera **todos los tenants** (sin filtro de tenant). Busca pedidos con `estado_pedido = pendiente_pago_online AND expires_at < NOW()` sin `tenant_id` en el WHERE (o filtrando por todos los tenants activos si el campo está disponible).
- **Rationale**: El job corre en contexto de sistema, no de request. `BaseCrudTenantService.getTenantId()` requiere contexto de request. El job usa `repository` o `DataSource` directamente sin el BaseCrudTenantService para esta operación de limpieza global.
- **Alternatives considered**: Correr el job una vez por tenant — requiere conocer todos los tenants; sobreingeniería para Stage 3.
