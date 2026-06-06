---
description: "Task list for alergenos module — Type A CRUD tenant-safe (idéntico a categorias-menu y etiquetas-menu con diferencias: activo masculino, sin orden_visualizacion)"
---

# Tasks: Módulo Alérgenos

**Input**: Design documents from `specs/006-alergenos-crud/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-endpoints.md ✅, quickstart.md ✅

**Tests**: No se incluyen tareas de tests (no solicitadas en la spec).

**Pattern**: Idéntico a `categorias-menu` (003) y `etiquetas-menu` (005). Sustituciones clave:
- `CategoriaMenu/EtiquetaMenu` → `Alergeno`
- `categorias_menu/etiquetas_menu` → `alergenos`
- alias QB `cm/em` → `al`
- `activa` → `activo` (masculino — campo diferente)
- Sin `orden_visualizacion` — sortAllowed solo `['nombre', 'created_at']`
- `listPublic()`: `ORDER BY al.nombre ASC` (sin NULLS LAST)
- Error codes `ETIQUETA_MENU_*` → `ALERGENO_*`
- Audit actions `etiqueta_menu.*` → `alergeno.*`

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US5 del spec.md)

---

## Phase 1: Setup

**Purpose**: Preparar la infraestructura compartida del módulo antes de cualquier historia de usuario.

- [x] T001 Agregar 5 códigos de error en `src/common/errors/error-codes.ts`: `ALERGENO_NOT_FOUND`, `ALERGENO_NOMBRE_DUPLICADO`, `ALERGENO_YA_ACTIVO`, `ALERGENO_YA_INACTIVO`, `ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`
- [x] T002 Crear estructura de directorios `src/modules/alergenos/entities/` y `src/modules/alergenos/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, migración, DTOs y servicio base que TODAS las historias de usuario requieren.

**⚠️ CRÍTICO**: Ninguna historia de usuario puede implementarse hasta que esta fase esté completa.

- [x] T003 [P] Crear entidad `Alergeno` en `src/modules/alergenos/entities/alergeno.entity.ts` — `@Entity('alergenos')`, `@Index('UQ_alergenos_tenant_nombre', ['tenant_id','nombre'], {unique:true})`; campos: `nombre varchar(100)`, `descripcion varchar(300) nullable`, `activo boolean default true` (SIN `orden_visualizacion`); extiende `BaseEntity`
- [x] T004 [P] Crear `CreateAlergenoDto` en `src/modules/alergenos/dto/create-alergeno.dto.ts` — `nombre` (`@IsString @IsNotEmpty @MaxLength(100)`), `descripcion` (`@IsOptional @IsString @MaxLength(300)`); sin `orden_visualizacion`
- [x] T005 [P] Crear `UpdateAlergenoDto` en `src/modules/alergenos/dto/update-alergeno.dto.ts` — mismos campos que Create pero todos con `@IsOptional`; sin PartialType (declarar explícitamente); sin `orden_visualizacion`
- [x] T006 [P] Crear `QueryAlergenoDto` en `src/modules/alergenos/dto/query-alergeno.dto.ts` — extiende `PageQueryDto`; `q` (`@IsOptional @IsString`), `activo` (`@IsOptional @Transform @IsBoolean` — ojo: masculino `activo`), `sortBy` (`@IsOptional @IsString`), `sortOrder` (`@IsOptional @IsIn(['ASC','DESC'])`)
- [x] T007 Generar migración con `npm run db:migration:generate -- migrations/CreateAlergenos` y editar el archivo generado: reemplazar índice único completo por `CREATE UNIQUE INDEX "UQ_alergenos_tenant_nombre" ON "alergenos" ("tenant_id","nombre") WHERE "deleted_at" IS NULL`; en `down()` usar `DROP INDEX IF EXISTS "public"."UQ_alergenos_tenant_nombre"` (depende de T003)
- [x] T008 Implementar `AlergenosService` en `src/modules/alergenos/alergenos.service.ts` — extiende `BaseCrudTenantService<Alergeno>`; constructor con `@InjectRepository(Alergeno) private readonly alergenoRepo`; QB alias `'al'`; método privado `assertNombreUnico(nombre, excludeId?)` con LOWER+tenant+deleted_at; método `findOne(id)` con `findById` + throw `ALERGENO_NOT_FOUND`; métodos `list()` con `filterAllowed:['activo']` y `sortAllowed:['nombre','created_at']`; `create()`, `update()`, `activar()` con `ALERGENO_YA_ACTIVO`, `inactivar()` con `ALERGENO_YA_INACTIVO` + comentario MVP, `remove()` con `ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`, `listPublic()` con QB alias `'al'` + `al.activo = true` + `ORDER BY al.nombre ASC` (sin NULLS LAST) (depende de T003, T001)
- [x] T009 Crear `AlergenosModule` en `src/modules/alergenos/alergenos.module.ts` — `TypeOrmModule.forFeature([Alergeno])`, imports: `[AuditModule]`, providers: `[AlergenosService]`, exports: `[AlergenosService]`; importar `AlergenosModule` en `src/app.module.ts` (depende de T008)

**Checkpoint**: Entidad, DTOs, servicio y módulo listos. `npm run start:dev` debe compilar sin errores.

---

## Phase 3: User Story 1 + User Story 5 — Admin CRUD core (Priority: P1) 🎯 MVP

**US1 Goal**: El administrador puede crear y editar alérgenos desde el back office.
**US5 Goal**: Administrador y supervisor pueden listar y ver el detalle de alérgenos.

**Independent Test**: `POST /admin/alergenos` crea un alérgeno y `GET /admin/alergenos` lo devuelve paginado. Nombre duplicado devuelve 409. Supervisor puede listar pero no crear.

- [x] T010 [US1] [US5] Implementar `AlergenosController` en `src/modules/alergenos/alergenos.controller.ts` — `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Controller('admin/alergenos')`; `GET /` con `@Roles('administrador','supervisor')` retorna `page(items,...)`; `GET /:id` con `@Roles('administrador','supervisor')` retorna `ok(alergeno)`; `POST /` con `@Roles('administrador')` `@HttpCode(201)` + audit `alergeno.created` + retorna `ok(alergeno)`; `PATCH /:id` con `@Roles('administrador')` + audit `alergeno.updated` + retorna `ok(alergeno)` (depende de T009)

**Checkpoint**: Smoke tests 1–4 del quickstart.md pasan.

---

## Phase 4: User Story 2 — Ciclo de vida: activar e inactivar (Priority: P2)

**Goal**: El administrador puede activar o inactivar un alérgeno para controlar su disponibilidad para nuevos menús y su visibilidad en el portal público.

**Independent Test**: `PATCH /admin/alergenos/:id/inactivar` cambia `activo` a `false`. Inactivar ya inactivo devuelve `ALERGENO_YA_INACTIVO`.

- [x] T011 [US2] Agregar `PATCH /:id/activar` y `PATCH /:id/inactivar` a `src/modules/alergenos/alergenos.controller.ts` — ambos con `@Roles('administrador')`; audit `alergeno.activated` / `alergeno.deactivated`; retornan `ok(alergeno)` (los métodos del service ya están en T008)

**Checkpoint**: Smoke test 5 del quickstart.md pasa.

---

## Phase 5: User Story 4 — Portal público (Priority: P2)

**Goal**: El portal público puede obtener todos los alérgenos activos del tenant, ordenados alfabéticamente, para mostrar en el detalle de cada menú.

**Independent Test**: `GET /public/alergenos` con `x-tenant-key` devuelve solo alérgenos activos ordenados por `nombre ASC`.

- [x] T012 [US4] Crear `PublicAlergenosController` en `src/modules/alergenos/public-alergenos.controller.ts` — `@Controller('public/alergenos')` SIN guards; `@Get()` llama `svc.listPublic()` retorna `ok(alergenos)`; registrar en `AlergenosModule.controllers` (el método `listPublic()` ya está en T008)

**Checkpoint**: Smoke tests 7–8 del quickstart.md pasan.

---

## Phase 6: User Story 3 — Soft delete (Priority: P3)

**Goal**: El administrador puede eliminar lógicamente un alérgeno inactivo.

**Independent Test**: `DELETE` sobre alérgeno activo devuelve `ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`. Sobre inactivo funciona.

- [x] T013 [US3] Agregar `DELETE /:id` a `src/modules/alergenos/alergenos.controller.ts` — `@Roles('administrador')`; llama `svc.remove(id)` + audit `alergeno.deleted`; retorna `ok({id})` (el método `remove()` ya está en T008)

**Checkpoint**: Smoke test 6 del quickstart.md pasa.

---

## Phase 7: Polish & Verificación Final

- [x] T014 Ejecutar `npm run build` y verificar que el proyecto compila sin errores TypeScript
- [ ] T015 Ejecutar todos los smoke tests del `specs/006-alergenos-crud/quickstart.md` (1–9) contra el servidor en local y confirmar que todos pasan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todo
- **Phase 3 (US1+US5)**: Depende de Phase 2
- **Phase 4 (US2)**: Depende de Phase 2 (métodos del service en T008)
- **Phase 5 (US4)**: Depende de Phase 2
- **Phase 6 (US3)**: Depende de Phase 2
- **Polish**: Depende de todas las fases anteriores

### Parallel Opportunities

```
Phase 1:  T001 ──┐
          T002 ──┘ (sin dependencias)

Phase 2:  T003 ──┐
          T004 ──┤ (en paralelo — archivos distintos)
          T005 ──┤
          T006 ──┘
          T007 ── (espera T003)
          T008 ── (espera T001, T003)
          T009 ── (espera T008)

Después de Phase 2:
  Phase 3 (T010) ──┐
  Phase 4 (T011) ──┤ (pueden comenzar en paralelo — mismos archivos del controller → secuencial)
  Phase 5 (T012) ──┘ (archivo distinto — paralelo con T010/T011)
```

---

## Implementation Strategy

### MVP First (US1 + US5)

1. Phase 1 → Phase 2 → Phase 3 (T010)
2. **Validar**: Smoke tests 1–4 del quickstart.md
3. Módulo ya entrega valor — admin puede crear y consultar alérgenos

### Entrega Incremental

1. Phase 2: Base lista
2. Phase 3: Admin CRUD ✅
3. Phase 4: Ciclo de vida ✅
4. Phase 5: Portal público ✅
5. Phase 6: Soft delete ✅
6. Phase 7: Verificación final

---

## Notes

- Módulo idéntico a `categorias-menu`/`etiquetas-menu` con diferencias explícitas
- Alias QB: `'al'` (no `'cm'` ni `'em'`)
- Campo `activo` (masculino) — NO `activa` — crítico para filtros y lógica de estado
- Sin `orden_visualizacion` — `sortAllowed` solo incluye `['nombre', 'created_at']`
- `listPublic()`: `ORDER BY al.nombre ASC` — sin `NULLS LAST` (nombre es NOT NULL)
- Sin query params en endpoint público
- Sin PartialType en UpdateDto
- `alergeno.*` para audit actions (no `categoria_menu.*` ni `etiqueta_menu.*`)
- Exporta `AlergenosService` — será usado por `MenusBaseModule` en Stage 2
