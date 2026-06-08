# Tasks: Integración Mercado Pago

**Input**: Design documents from `/specs/013-mercado-pago-integration/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: No se solicitaron tareas de test explícitas — no se incluyen.

**Organization**: Tareas agrupadas por historia de usuario para implementación y verificación independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias de tareas incompletas)
- **[Story]**: Historia de usuario a la que pertenece la tarea (US1, US2, US3)
- Paths exactos de archivo incluidos en cada descripción

---

## Phase 1: Setup (Infraestructura Transversal)

**Purpose**: Cambios cross-cutting requeridos antes de construir el módulo: error codes, configuración de entorno, y estructura de archivos del módulo.

- [X] T001 Agregar 3 nuevos códigos de error en `src/common/errors/error-codes.ts`: `MERCADO_PAGO_ERROR_PREFERENCIA`, `MERCADO_PAGO_FIRMA_INVALIDA`, `MERCADO_PAGO_WEBHOOK_LOG_NOT_FOUND`
- [X] T002 [P] Agregar sección `mercadoPago` en `src/config/configuration.ts` con campos: `accessToken` (MP_ACCESS_TOKEN), `webhookSecret` (MP_WEBHOOK_SECRET), `successUrl` (MP_SUCCESS_URL), `failureUrl` (MP_FAILURE_URL), `pendingUrl` (MP_PENDING_URL)
- [X] T003 [P] Agregar variables MP_* (todas opcionales) en `src/config/env.validation.ts` para no romper entornos sin MP configurado
- [X] T004 Crear estructura de directorios del módulo y el archivo stub `src/modules/mercado-pago/mercado-pago.module.ts` con la configuración completa: `TypeOrmModule.forFeature([MercadoPagoWebhookLog])`, imports con `forwardRef(() => PedidosModule)` y `PagosModule`, providers `MercadoPagoService` y `MercadoPagoWebhookService`, controllers `MercadoPagoController` y `MercadoPagoWebhookController`, exports `MercadoPagoService`

**Checkpoint**: Infraestructura base lista. La compilación del proyecto no debe romper tras estos cambios.

---

## Phase 2: Foundational (Prerequisitos Bloqueantes)

**Purpose**: Entidad, migración y DTO base que DEBEN estar completos antes de implementar cualquier historia de usuario.

**⚠️ CRITICAL**: Ninguna historia de usuario puede comenzar hasta que esta fase esté completa.

- [X] T005 Crear `src/modules/mercado-pago/entities/mercado-pago-webhook-log.entity.ts` con enum `ResultadoProcesamiento` (`procesado_ok`, `procesado_error`, `pendiente_revision`) y entidad `MercadoPagoWebhookLog` con todos los campos del data-model: `id` (uuid), `tenant_id`, `pedido_id` (nullable, sin FK), `tipo_evento` varchar(100), `referencia_externa` varchar(200) nullable, `payload` jsonb, `resultado_procesamiento` varchar(50) default `pendiente_revision`, `mensaje_error` text nullable, `fecha_recepcion` timestamptz, `created_at`; con `@Index(['tenant_id','pedido_id'])` e `@Index(['tenant_id','resultado_procesamiento'])`
- [X] T006 Generar migración de base de datos con `npm run db:migration:generate -- migrations/CreateMercadoPagoWebhookLogs` y verificar que el SQL generado use tipo `jsonb` para `payload` y que no incluya FK a la tabla `pedidos`
- [X] T007 [P] Crear `src/modules/mercado-pago/dto/query-webhook-log.dto.ts` con `QueryWebhookLogDto`: campos opcionales `pedido_id` (IsUUID), `resultado` (IsEnum ResultadoProcesamiento), `page` (IsInt, Min 1), `limit` (IsInt, Min 1, Max 100)
- [X] T008 Registrar `MercadoPagoModule` en `src/app.module.ts` en la sección de módulos de negocios

**Checkpoint**: Entidad y migración listas. El módulo se puede importar sin errores. Se puede ejecutar la migración.

---

## Phase 3: User Story 1 — Generación de Preferencia de Pago (Priority: P1) 🎯 MVP

**Goal**: El sistema puede generar una preferencia de pago en Mercado Pago cuando PedidosService crea un pedido online, retornando la URL de checkout al cliente.

**Independent Test**: Crear un pedido con método de pago online desde el portal público y verificar que la respuesta incluye `init_point` (URL de checkout de MP) y `preference_id`. Verificar que sin MP_ACCESS_TOKEN configurado el sistema lanza error apropiado.

### Implementation for User Story 1

- [X] T009 [US1] Implementar `MercadoPagoService` en `src/modules/mercado-pago/mercado-pago.service.ts` con método `generarPreferencia(pedidoId: string, importe: number, descripcion: string, tenantId: string): Promise<{ preference_id: string; init_point: string }>`: usar `fetch` nativo para POST a `https://api.mercadopago.com/checkout/preferences` con `Authorization: Bearer <MP_ACCESS_TOKEN>`; incluir `items`, `external_reference: pedidoId`, y `back_urls` (successUrl, failureUrl, pendingUrl) desde ConfigService; lanzar `AppError(ErrorCodes.MERCADO_PAGO_ERROR_PREFERENCIA)` si la llamada HTTP falla o la respuesta no es 2xx
- [X] T010 [P] [US1] Agregar método `confirmarPagoOnline(pedidoId: string, tenantId: string): Promise<void>` en `src/modules/pedidos/pedidos.service.ts`: transiciona `EstadoPedido.PENDIENTE_PAGO_ONLINE` → `EstadoPedido.CONFIRMADO_PAGO_ONLINE`; si el pedido ya está en `CONFIRMADO_PAGO_ONLINE` retorna sin error (idempotente); si está en otro estado incompatible lanza `AppError`
- [X] T011 [P] [US1] Agregar `forwardRef(() => MercadoPagoModule)` en los imports de `src/modules/pedidos/pedidos.module.ts` e inyectar `MercadoPagoService` con `@Inject(forwardRef(() => MercadoPagoService))` en `PedidosService`
- [X] T012 [US1] Integrar llamada a `mercadoPagoService.generarPreferencia()` en el flujo de creación de pedido online en `src/modules/pedidos/pedidos.service.ts` (método que crea pedidos con `metodo_pago = online`): llamar tras crear el pago online con `PagosService.crearPagoOnline()`, guardar el `preference_id` y `init_point` retornados, incluirlos en la respuesta del pedido; si `generarPreferencia` lanza error, propagar la excepción (el pedido no se confirma)

**Checkpoint**: US1 completa. Crear pedido online retorna URL de checkout funcional de Mercado Pago.

---

## Phase 4: User Story 2 — Procesamiento de Webhook de Pago (Priority: P1)

**Goal**: El sistema recibe notificaciones de Mercado Pago, valida la firma, actualiza el estado del pago y pedido según el resultado, y registra cada evento en el log. Siempre responde HTTP 200.

**Independent Test**: Enviar manualmente un POST a `POST /webhooks/mercado-pago` con header `x-tenant-key` y body de tipo `payment` aprobado. Verificar: (1) respuesta es HTTP 200 con `{ ok: true, data: { received: true } }`, (2) existe un registro en `mercado_pago_webhook_logs` con `resultado_procesamiento = procesado_ok`, (3) el pedido referenciado está en estado `confirmado_pago_online`, (4) el pago tiene `estado = aprobado`. Repetir con pago rechazado y con firma inválida.

### Implementation for User Story 2

- [X] T013 [US2] Implementar `MercadoPagoWebhookService` en `src/modules/mercado-pago/mercado-pago-webhook.service.ts` con los siguientes métodos:
  - `validarFirmaHmac(rawBody: string, signature: string | undefined): void` — si `MP_WEBHOOK_SECRET` configurado: calcula HMAC-SHA256 con `crypto.createHmac` y compara con `signature`; si inválida: lanza `AppError(ErrorCodes.MERCADO_PAGO_FIRMA_INVALIDA)` (este error se captura en el llamador, NO se propaga a HTTP)
  - `procesarWebhook(payload: any, headers: Record<string, string>, tenantId: string): Promise<void>` — orquesta: (1) validar firma, (2) crear log con `resultado=pendiente_revision`, (3) try { si `type === 'payment'`: fetch payment desde MP y rutear a `procesarPagoAprobado` o `procesarPagoRechazado` } catch (e) { actualizar log a `procesado_error`, `mensaje_error = e.message` }, (4) siempre retornar sin error al controller
  - `procesarPagoAprobado(paymentId: string, tenantId: string, logId: string): Promise<void>` — fetch `GET https://api.mercadopago.com/v1/payments/:id` → extraer `external_reference` (= pedidoId) → `pagosService.actualizarEstadoOnline(pedidoId, EstadoPago.APROBADO, paymentId)` → `pedidosService.confirmarPagoOnline(pedidoId, tenantId)` → actualizar log a `procesado_ok`
  - `procesarPagoRechazado(paymentId: string, tenantId: string, logId: string): Promise<void>` — fetch payment → extraer `external_reference` → `pagosService.actualizarEstadoOnline(pedidoId, EstadoPago.RECHAZADO)` → actualizar log a `procesado_ok`
- [X] T014 [US2] Implementar `MercadoPagoWebhookController` en `src/modules/mercado-pago/mercado-pago-webhook.controller.ts`: `@Controller('webhooks')`, sin `JwtAuthGuard`, método `POST /mercado-pago` decorado con `@HttpCode(200)`; extraer `tenantId` del header `x-tenant-key` usando `TenancyService`; llamar `webhookService.procesarWebhook(body, headers, tenantId)`; siempre responder `ok({ received: true })` — envolver en try/catch para garantizar que cualquier excepción no catapultada retorne de igual manera HTTP 200

**Checkpoint**: US2 completa. Webhook de pago aprobado y rechazado procesado correctamente. Logs creados. Pedido y pago con estados actualizados. Respuesta siempre HTTP 200.

---

## Phase 5: User Story 3 — Consulta de Logs por Administrador (Priority: P2)

**Goal**: El administrador puede listar y consultar en detalle los logs de webhooks de Mercado Pago con paginación y filtros.

**Independent Test**: Autenticado con rol `administrador`, llamar `GET /admin/mercado-pago/logs` y verificar respuesta paginada. Filtrar por `resultado=procesado_error` y verificar que solo retorna logs con ese resultado. Llamar `GET /admin/mercado-pago/logs/:id` y verificar que incluye el campo `payload` completo. Verificar que un usuario sin rol `administrador` recibe 403.

### Implementation for User Story 3

- [X] T015 [US3] Implementar `MercadoPagoController` en `src/modules/mercado-pago/mercado-pago.controller.ts`: `@Controller('admin/mercado-pago')` con `JwtAuthGuard` y `RolesGuard`; método `GET /logs` con `@Roles('administrador')` que acepta `QueryWebhookLogDto`, filtra por `tenant_id` del contexto + filtros opcionales (`pedido_id`, `resultado`), retorna lista paginada con `page()` helper (sin campo `payload` en el listado); método `GET /logs/:id` con `@Roles('administrador')` que retorna el log completo incluyendo `payload` con `ok()` helper; lanzar `AppError(ErrorCodes.MERCADO_PAGO_WEBHOOK_LOG_NOT_FOUND)` si el log no existe o no pertenece al tenant

**Checkpoint**: US3 completa. Los tres endpoints (webhook público + 2 admin) están operativos. El módulo completo es funcional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificaciones finales de integración y consistencia del módulo.

- [X] T016 [P] Ejecutar migración en entorno de desarrollo con `npm run db:migration:run` y verificar en la DB que la tabla `mercado_pago_webhook_logs` existe con tipo `jsonb` para `payload`, sin FK a `pedidos`, y con los dos índices compuestos
- [X] T017 [P] Verificar que el proyecto compila sin errores de dependencia circular con `npm run build` — la circular dep PedidosModule ↔ MercadoPagoModule debe resolverse limpiamente con `forwardRef()`
- [X] T018 Verificar flujo end-to-end manual: (1) crear pedido online → recibir `init_point`, (2) simular webhook de pago aprobado → verificar estado del pedido = `confirmado_pago_online` y log = `procesado_ok`, (3) listar logs como admin y verificar registro presente

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 completa — BLOQUEA todas las historias de usuario
- **US1 (Phase 3)**: Depende de Phase 2 completa — sin dependencia de US2/US3
- **US2 (Phase 4)**: Depende de Phase 2 completa — sin dependencia de US1 (solo usa métodos existentes de PagosService y el nuevo `confirmarPagoOnline` de US1)
- **US3 (Phase 5)**: Depende de Phase 2 completa — sin dependencia de US1/US2
- **Polish (Phase 6)**: Depende de las historias de usuario que se deseen completar

### User Story Dependencies

- **US1 (P1)**: Puede comenzar tras Phase 2. No depende de US2 ni US3.
- **US2 (P1)**: Puede comenzar tras Phase 2. Depende de `confirmarPagoOnline` de US1 (T010) — coordinar si se implementan en paralelo.
- **US3 (P2)**: Puede comenzar tras Phase 2. Completamente independiente de US1 y US2.

### Within Each User Story

- US1: T009 (service) puede correr en paralelo con T010+T011 (changes to PedidosModule) → T012 depende de T009, T010, T011
- US2: T013 (service) → T014 (controller) son secuenciales
- US3: T015 es un solo bloque independiente

### Parallel Opportunities

- T002 y T003 (Phase 1) en paralelo
- T005 y T007 (Phase 2) en paralelo
- T009, T010, T011 (Phase 3) en paralelo entre sí
- T016 y T017 (Phase 6) en paralelo

---

## Parallel Example: User Story 1

```text
# En paralelo (archivos distintos, sin dependencias mutuas):
T009: Implement MercadoPagoService.generarPreferencia() in src/modules/mercado-pago/mercado-pago.service.ts
T010: Add confirmarPagoOnline() to src/modules/pedidos/pedidos.service.ts
T011: Add forwardRef(MercadoPagoModule) to src/modules/pedidos/pedidos.module.ts

# Luego, secuencialmente (depende de los tres anteriores):
T012: Integrate generarPreferencia() call in pedidos.service.ts
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Completar Phase 1: Setup (T001–T004)
2. Completar Phase 2: Foundational (T005–T008)
3. Completar Phase 3: US1 — Generación de preferencia (T009–T012)
4. Completar Phase 4: US2 — Procesamiento de webhook (T013–T014)
5. **STOP y VALIDAR**: Flujo completo pago online funcional (crear pedido → checkout → webhook → estado confirmado)
6. Completar Phase 5: US3 — Admin logs (T015)
7. Polish (T016–T018)

### Incremental Delivery

1. Setup + Foundational → módulo compila
2. + US1 → pedidos online generan checkout de MP
3. + US2 → pagos se confirman automáticamente por webhook
4. + US3 → admins pueden auditar eventos de pago
5. + Polish → verificación end-to-end

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí — pueden ejecutarse simultáneamente
- `[USx]` indica la historia de usuario a la que pertenece para trazabilidad con spec.md
- El webhook responde HTTP 200 SIEMPRE — esto es un requisito no negociable
- Toda excepción en el procesamiento de webhook va al log, nunca al respondedor HTTP
- No usar `throw new Error()` — siempre `AppError` con código de `ErrorCodes`
- La columna `payload` en la entidad usa `type: 'jsonb'` — verificar en la migración generada
- Hacer commit tras completar cada phase o tarea lógica
