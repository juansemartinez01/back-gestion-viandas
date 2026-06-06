---
description: "Task list for clientes module — Type A CRUD tenant-safe + upsertByDni interno, bloqueo/desbloqueo, sin portal público, sin soft delete operativo"
---

# Tasks: Módulo Clientes

**Input**: Design documents from `specs/007-clientes-upsert/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-endpoints.md ✅, quickstart.md ✅

**Tests**: No se incluyen tareas de tests (no solicitados en la spec).

**Diferencias clave vs alergenos (módulo anterior)**:
- Sin public controller (no `PublicClientesController`)
- Sin `create()` ni `update()` expuestos — solo `upsertByDni` interno
- Búsqueda OR en 3 campos: `dni ILIKE :q OR nombre ILIKE :q OR apellido ILIKE :q` (QB custom)
- `bloquear()` / `desbloquear()` en lugar de `activar()` / `inactivar()`
- Sin soft delete operativo (no `remove()`)
- QB alias `'cl'`; error codes `CLIENTE_*`; audit actions `cliente.*`
- Exporta `ClientesService` → `PedidosModule` (Stage 3)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US5 del spec.md)

---

## Phase 1: Setup

**Purpose**: Preparar la infraestructura compartida del módulo antes de cualquier historia de usuario.

- [x] T001 Agregar 4 códigos de error en `src/common/errors/error-codes.ts` — sección `// clientes`: `CLIENTE_NOT_FOUND`, `CLIENTE_DNI_DUPLICADO`, `CLIENTE_YA_BLOQUEADO`, `CLIENTE_YA_ACTIVO`
- [x] T002 Crear estructura de directorios `src/modules/clientes/entities/` y `src/modules/clientes/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, migración, DTOs y servicio completo que TODAS las historias de usuario requieren.

**⚠️ CRÍTICO**: Ninguna historia de usuario puede implementarse hasta que esta fase esté completa.

- [x] T003 [P] Crear entidad `Cliente` en `src/modules/clientes/entities/cliente.entity.ts` — `@Entity('clientes')`, `@Index('UQ_clientes_tenant_dni', ['tenant_id','dni'], {unique:true})`; campos: `dni varchar(20)`, `nombre varchar(100)`, `apellido varchar(100)`, `telefono varchar(50) nullable`, `email varchar(200) nullable`, `fecha_primera_operacion date`, `fecha_ultima_operacion date`, `activo boolean default true`; extiende `BaseEntity`
- [x] T004 [P] Crear `UpsertClienteDto` en `src/modules/clientes/dto/upsert-cliente.dto.ts` — `dni` (`@IsString @IsNotEmpty @MaxLength(20)`), `nombre` (`@IsString @IsNotEmpty @MaxLength(100)`), `apellido` (`@IsString @IsNotEmpty @MaxLength(100)`), `telefono` (`@IsOptional @IsString @MaxLength(50)`), `email` (`@IsOptional @IsEmail @MaxLength(200)`)
- [x] T005 [P] Crear `QueryClienteDto` en `src/modules/clientes/dto/query-cliente.dto.ts` — extiende `PageQueryDto`; `q` (`@IsOptional @IsString` — busca OR en dni/nombre/apellido), `activo` (`@IsOptional @Transform @IsBoolean`), `sortBy` (`@IsOptional @IsIn(['apellido','nombre','fecha_ultima_operacion','created_at'])`), `sortOrder` (`@IsOptional @IsIn(['ASC','DESC'])`)
- [x] T006 Generar migración con `npm run db:migration:generate -- migrations/CreateClientes` y editar el archivo generado: reemplazar índice único completo por `CREATE UNIQUE INDEX "UQ_clientes_tenant_dni" ON "clientes" ("tenant_id","dni") WHERE "deleted_at" IS NULL`; en `down()` usar `DROP INDEX IF EXISTS "public"."UQ_clientes_tenant_dni"` (depende de T003)
- [x] T007 Implementar `ClientesService` en `src/modules/clientes/clientes.service.ts` — extiende `BaseCrudTenantService<Cliente>`; constructor con `@InjectRepository(Cliente) private readonly clienteRepo`; QB alias `'cl'`; método `list(query: QueryClienteDto)` con QB propio: `tenant_id + deleted_at IS NULL`, cláusula OR `(cl.dni ILIKE :q OR cl.nombre ILIKE :q OR cl.apellido ILIKE :q)`, filtro `activo`, `ORDER BY cl.{sortBy} sortOrder` (default `apellido ASC`), `getManyAndCount()`; método `findOne(id)` con `findById + throw CLIENTE_NOT_FOUND`; método `upsertByDni(dto: UpsertClienteDto)` con `getTenantId({strictTenant:true})` + QB find `(tenant_id, dni, deleted_at IS NULL)` → si existe actualiza `nombre/apellido` siempre, `telefono/email` solo si `!== undefined && !== ''`, `fecha_ultima_operacion = new Date()`, `repo.save()` → si no existe `repo.create({...dto, tenant_id, fecha_primera_operacion: today, fecha_ultima_operacion: today, activo:true})`, `repo.save()`; método `bloquear(id)` con `findOne + if(!activo) throw CLIENTE_YA_BLOQUEADO + activo=false + repo.save`; método `desbloquear(id)` con `findOne + if(activo) throw CLIENTE_YA_ACTIVO + activo=true + repo.save` (depende de T001, T003)
- [x] T008 Crear `ClientesModule` en `src/modules/clientes/clientes.module.ts` — `TypeOrmModule.forFeature([Cliente])`, imports: `[AuditModule]`, providers: `[ClientesService]`, controllers: `[ClientesController]`, exports: `[ClientesService]`; importar `ClientesModule` en `src/app.module.ts` (depende de T007)

**Checkpoint**: Entidad, DTOs, servicio y módulo listos. `npm run start:dev` debe compilar sin errores.

---

## Phase 3: User Story 1 + User Story 2 — Consulta back office (Priority: P1) 🎯 MVP

**US1 Goal**: Administrador y supervisor pueden listar clientes con paginación, búsqueda por DNI/nombre/apellido, filtro por activo y ordenamiento.
**US2 Goal**: Administrador y supervisor pueden ver el detalle completo de un cliente por ID.

**Independent Test**: `GET /admin/clientes?q=perez&activo=true` con JWT de administrador devuelve paginado. `GET /admin/clientes/:id` devuelve detalle. ID de otro tenant devuelve 404. Sin JWT devuelve 401.

- [x] T009 [US1] [US2] Implementar `ClientesController` en `src/modules/clientes/clientes.controller.ts` — `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Controller('admin/clientes')`; `GET /` con `@Roles('administrador','supervisor')` retorna `page(items, query.page ?? 1, query.limit ?? 20, total)` llamando `svc.list(query)`; `GET /:id` con `@Roles('administrador','supervisor')` retorna `ok(await svc.findOne(id))` (depende de T008)

**Checkpoint**: Smoke tests 3–4 del quickstart.md pasan. `npm run build` sin errores.

---

## Phase 4: User Story 3 — upsertByDni interno (Priority: P1)

**Goal**: El método `upsertByDni` crea o actualiza un cliente automáticamente cuando se registra un pedido — primer registro con `fecha_primera_operacion`, actualizaciones posteriores sin sobrescribir campos opcionales vacíos.

**Independent Test**: Llamar `clientesService.upsertByDni(dto)` con DNI nuevo → crea cliente con `fecha_primera_operacion = hoy`. Segunda llamada con mismo DNI → actualiza datos y `fecha_ultima_operacion`; `fecha_primera_operacion` no cambia; si `telefono` viene undefined no se pisa el existente.

> **Nota**: `upsertByDni` ya está implementado en T007. Esta fase valida que el método está correctamente exportado y es invocable por un módulo externo.

- [x] T010 [US3] Verificar que `ClientesService` está en `exports` de `src/modules/clientes/clientes.module.ts` y que `upsertByDni` tiene firma pública correcta (`async upsertByDni(dto: UpsertClienteDto): Promise<Cliente>`) en `src/modules/clientes/clientes.service.ts` — confirmar que el import de `UpsertClienteDto` es accesible externamente; ejecutar smoke tests 1–2 del `specs/007-clientes-upsert/quickstart.md` contra servidor local

**Checkpoint**: `upsertByDni` invocable, crea cliente nuevo con las dos fechas = hoy, segunda llamada actualiza sin duplicar, `fecha_primera_operacion` invariante.

---

## Phase 5: User Story 4 + User Story 5 — Bloquear y desbloquear (Priority: P2)

**US4 Goal**: Administrador bloquea un cliente activo (`activo=false`) con registro de auditoría.
**US5 Goal**: Administrador desbloquea un cliente bloqueado (`activo=true`) con registro de auditoría.

**Independent Test**: `PATCH /admin/clientes/:id/bloquear` con JWT de administrador devuelve cliente con `activo=false` y genera entrada en `audit_logs`. Bloquear dos veces devuelve 409 `CLIENTE_YA_BLOQUEADO`. JWT de supervisor devuelve 403. Desbloquear dos veces devuelve 409 `CLIENTE_YA_ACTIVO`.

- [x] T011 [US4] [US5] Agregar `PATCH /:id/bloquear` y `PATCH /:id/desbloquear` a `src/modules/clientes/clientes.controller.ts` — ambos con `@Roles('administrador')` únicamente; `bloquear`: llama `svc.bloquear(id)` + `auditLogPayload` con `action:'cliente.bloqueado', entity:'cliente', extra:{clienteId,dni,nombre,apellido}` + `logger.info + audit.write` + retorna `ok(cl)`; `desbloquear`: mismo patrón con `action:'cliente.desbloqueado'` + retorna `ok(cl)` (depende de T009)

**Checkpoint**: Smoke tests 5–7 del quickstart.md pasan. Registro en `audit_logs` presente tras bloquear y desbloquear.

---

## Phase 6: Polish & Verificación Final

- [x] T012 Ejecutar `npm run build` y verificar que el proyecto compila sin errores TypeScript
- [ ] T013 Ejecutar todos los smoke tests del `specs/007-clientes-upsert/quickstart.md` y confirmar que todos pasan contra servidor local
- [ ] T014 Verificar que `GET /admin/clientes?activo=false` no devuelve clientes activos y que `GET /admin/clientes?q=X` busca en los tres campos (dni, nombre, apellido)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias
- **Foundational (Phase 2)**: Depende de Phase 1 — BLOQUEA todo
- **Phase 3 (US1+US2)**: Depende de Phase 2
- **Phase 4 (US3)**: Depende de Phase 2 (upsertByDni en T007); puede ejecutarse en paralelo con Phase 3
- **Phase 5 (US4+US5)**: Depende de Phase 3 (agrega endpoints al controller existente)
- **Polish (Phase 6)**: Depende de todas las fases anteriores

### Parallel Opportunities

```
Phase 1:  T001 ──┐
          T002 ──┘ (sin dependencias — paralelo)

Phase 2:  T003 ──┐
          T004 ──┤ (en paralelo — archivos distintos)
          T005 ──┘
          T006 ── (espera T003)
          T007 ── (espera T001, T003)
          T008 ── (espera T007)

Después de Phase 2:
  Phase 3 (T009) ──┐ (mismo archivo controller — secuencial entre sí)
  Phase 4 (T010) ──┘ (archivo distinto del controller — paralelo con T009)
  
  Phase 5 (T011) ── (espera T009 porque edita el mismo controller)
```

---

## Implementation Strategy

### MVP First (US1 + US2 — consulta back office)

1. Phase 1 → Phase 2 → Phase 3 (T009)
2. **Validar**: Smoke tests 3–4 del quickstart.md
3. El back office ya puede consultar la base de clientes (creada via seed o upsert manual)

### Entrega Incremental

1. Phase 1+2: Base lista
2. Phase 3: Consulta back office ✅ (MVP para supervisores)
3. Phase 4: upsertByDni validado ✅ (ready para Stage 3)
4. Phase 5: Bloquear/desbloquear ✅
5. Phase 6: Verificación final

---

## Notes

- Alias QB: `'cl'` (no `'al'` ni `'cm'`)
- Sin `create()` ni `update()` públicos en el controller — solo `upsertByDni` interno
- Sin `PublicClientesController` — clientes nunca se listan públicamente
- Sin soft delete operativo — no hay `DELETE` endpoint ni `remove()` en service
- Campo `activo` (masculino) — bloqueo = `activo=false`, desbloqueo = `activo=true`
- `list()` usa QB propio (no `super.list()`) para soportar OR en 3 campos
- `upsertByDni`: no pisar `telefono`/`email` si vienen `undefined` o `''`
- `fecha_primera_operacion` solo se asigna al crear, nunca en la rama de update
- Exporta `ClientesService` obligatoriamente — `PedidosModule` (Stage 3) depende de esto
- Audit actions: `cliente.bloqueado`, `cliente.desbloqueado` (solo estas dos)
