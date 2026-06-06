---
description: "Task list for etiquetas-menu module — Type A CRUD tenant-safe (identical pattern to categorias-menu)"
---

# Tasks: Módulo Etiquetas de Menú

**Input**: Design documents from `specs/005-etiquetas-menu-crud/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-endpoints.md ✅, quickstart.md ✅

**Tests**: No se incluyen tareas de tests (no solicitadas en la spec).

**Pattern**: Idéntico a `categorias-menu` (003). Sustituciones: `CategoriaMenu` → `EtiquetaMenu`, `categorias_menu` → `etiquetas_menu`, alias QB `cm` → `em`, error codes `CATEGORIA_MENU_*` → `ETIQUETA_MENU_*`, audit actions `categoria_menu.*` → `etiqueta_menu.*`.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US5 del spec.md)

---

## Phase 1: Setup

**Purpose**: Preparar la infraestructura compartida del módulo antes de cualquier historia de usuario.

- [x] T001 Agregar 5 códigos de error en `src/common/errors/error-codes.ts`: `ETIQUETA_MENU_NOT_FOUND`, `ETIQUETA_MENU_NOMBRE_DUPLICADO`, `ETIQUETA_MENU_YA_ACTIVA`, `ETIQUETA_MENU_YA_INACTIVA`, `ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`
- [x] T002 Crear estructura de directorios `src/modules/etiquetas-menu/entities/` y `src/modules/etiquetas-menu/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, migración, DTOs y servicio base que TODAS las historias de usuario requieren.

**⚠️ CRÍTICO**: Ninguna historia de usuario puede implementarse hasta que esta fase esté completa.

- [x] T003 [P] Crear entidad `EtiquetaMenu` en `src/modules/etiquetas-menu/entities/etiqueta-menu.entity.ts` — `@Entity('etiquetas_menu')`, `@Index('UQ_etiquetas_menu_tenant_nombre', ['tenant_id','nombre'], {unique:true})`; campos: `nombre varchar(100)`, `descripcion varchar(300) nullable`, `activa boolean default true`, `orden_visualizacion int nullable`; extiende `BaseEntity`
- [x] T004 [P] Crear `CreateEtiquetaMenuDto` en `src/modules/etiquetas-menu/dto/create-etiqueta-menu.dto.ts` — `nombre` (`@IsString @IsNotEmpty @MaxLength(100)`), `descripcion` (`@IsOptional @IsString @MaxLength(300)`), `orden_visualizacion` (`@IsOptional @Type(()=>Number) @IsInt @Min(1)`)
- [x] T005 [P] Crear `UpdateEtiquetaMenuDto` en `src/modules/etiquetas-menu/dto/update-etiqueta-menu.dto.ts` — mismos campos que Create pero todos con `@IsOptional`; sin PartialType (declarar explícitamente)
- [x] T006 [P] Crear `QueryEtiquetaMenuDto` en `src/modules/etiquetas-menu/dto/query-etiqueta-menu.dto.ts` — extiende `PageQueryDto`; `q` (`@IsOptional @IsString`), `activa` (`@IsOptional @Transform @IsBoolean`), `sortBy` (`@IsOptional @IsString`), `sortOrder` (`@IsOptional @IsIn(['ASC','DESC'])`)
- [x] T007 Generar migración con `npm run db:migration:generate -- migrations/CreateEtiquetasMenu` y editar el archivo generado: reemplazar índice único completo por `CREATE UNIQUE INDEX "UQ_etiquetas_menu_tenant_nombre" ON "etiquetas_menu" ("tenant_id","nombre") WHERE "deleted_at" IS NULL`; agregar `DROP INDEX IF EXISTS "UQ_etiquetas_menu_tenant_nombre"` en `down()` (depende de T003)
- [x] T008 Implementar `EtiquetasMenuService` en `src/modules/etiquetas-menu/etiquetas-menu.service.ts` — extiende `BaseCrudTenantService<EtiquetaMenu>`; constructor con `@InjectRepository(EtiquetaMenu) private readonly etiquetaMenuRepo`; método privado `assertNombreUnico(nombre, excludeId?)` con QB alias `'em'` + LOWER+tenant+deleted_at; método `findOne(id)` con `findById` + throw `ETIQUETA_MENU_NOT_FOUND`; métodos `list()`, `create()`, `update()`, `activar()`, `inactivar()`, `remove()`, `listPublic()` — todos idénticos a `CategoriasMenuService` con sustitución de nombres (depende de T003, T001)
- [x] T009 Crear `EtiquetasMenuModule` en `src/modules/etiquetas-menu/etiquetas-menu.module.ts` — `TypeOrmModule.forFeature([EtiquetaMenu])`, imports: `[AuditModule]`, providers: `[EtiquetasMenuService]`, exports: `[EtiquetasMenuService]`; importar `EtiquetasMenuModule` en `src/app.module.ts` (depende de T008)

**Checkpoint**: Entidad, DTOs, servicio y módulo listos. `npm run start:dev` debe compilar sin errores.

---

## Phase 3: User Story 1 + User Story 5 — Admin CRUD core (Priority: P1) 🎯 MVP

**US1 Goal**: El administrador puede crear y editar etiquetas desde el back office.
**US5 Goal**: Administrador y supervisor pueden listar y ver el detalle de etiquetas.

**Independent Test**: `POST /admin/etiquetas-menu` crea una etiqueta y `GET /admin/etiquetas-menu` la devuelve paginada. Nombre duplicado devuelve 409. Supervisor puede listar pero no crear.

- [x] T010 [US1] [US5] Implementar `EtiquetasMenuController` en `src/modules/etiquetas-menu/etiquetas-menu.controller.ts` — `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Controller('admin/etiquetas-menu')`; `GET /` con `@Roles('administrador','supervisor')` retorna `page(items,...)`; `GET /:id` con `@Roles('administrador','supervisor')` retorna `ok(etiqueta)`; `POST /` con `@Roles('administrador')` `@HttpCode(201)` + audit `etiqueta_menu.created` + retorna `ok(etiqueta)`; `PATCH /:id` con `@Roles('administrador')` + audit `etiqueta_menu.updated` + retorna `ok(etiqueta)` (depende de T009)

**Checkpoint**: Smoke tests 1–3 del quickstart.md pasan.

---

## Phase 4: User Story 2 — Ciclo de vida: activar e inactivar (Priority: P2)

**Goal**: El administrador puede activar o inactivar una etiqueta para controlar su visibilidad en el portal y disponibilidad para menús.

**Independent Test**: `PATCH /admin/etiquetas-menu/:id/inactivar` cambia `activa` a `false`. Inactivar ya inactiva devuelve `ETIQUETA_MENU_YA_INACTIVA`.

- [x] T011 [US2] Agregar `PATCH /:id/activar` y `PATCH /:id/inactivar` a `src/modules/etiquetas-menu/etiquetas-menu.controller.ts` — ambos con `@Roles('administrador')`; audit `etiqueta_menu.activated` / `etiqueta_menu.deactivated`; retornan `ok(etiqueta)` (los métodos del service ya están en T008)

**Checkpoint**: Smoke tests 4–5 del quickstart.md pasan.

---

## Phase 5: User Story 4 — Portal público (Priority: P2)

**Goal**: El portal público puede obtener todas las etiquetas activas del tenant, ordenadas para mostrar en las cards de menú.

**Independent Test**: `GET /public/etiquetas-menu` con `x-tenant-key` devuelve solo etiquetas activas ordenadas por `orden_visualizacion ASC NULLS LAST`.

- [x] T012 [US4] Crear `PublicEtiquetasMenuController` en `src/modules/etiquetas-menu/public-etiquetas-menu.controller.ts` — `@Controller('public/etiquetas-menu')` SIN guards; `@Get()` llama `svc.listPublic()` retorna `ok(etiquetas)`; registrar en `EtiquetasMenuModule.controllers` (el método `listPublic()` ya está en T008)

**Checkpoint**: Smoke tests 7–8 del quickstart.md pasan.

---

## Phase 6: User Story 3 — Soft delete (Priority: P3)

**Goal**: El administrador puede eliminar lógicamente una etiqueta inactiva.

**Independent Test**: `DELETE` sobre etiqueta activa devuelve `ETIQUETA_MENU_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`. Sobre inactiva funciona.

- [x] T013 [US3] Agregar `DELETE /:id` a `src/modules/etiquetas-menu/etiquetas-menu.controller.ts` — `@Roles('administrador')`; llama `svc.remove(id)` + audit `etiqueta_menu.deleted`; retorna `ok({id})` (el método `remove()` ya está en T008)

**Checkpoint**: Smoke test 6 del quickstart.md pasa.

---

## Phase 7: Polish & Verificación Final

- [x] T014 Ejecutar `npm run build` y verificar que el proyecto compila sin errores TypeScript
- [ ] T015 Ejecutar todos los smoke tests del `specs/005-etiquetas-menu-crud/quickstart.md` (1–9) contra el servidor en local y confirmar que todos pasan

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
  Phase 4 (T011) ──┤ (pueden comenzar en paralelo — archivos distintos del controller)
  Phase 5 (T012) ──┘
```

---

## Implementation Strategy

### MVP First (US1 + US5)

1. Phase 1 → Phase 2 → Phase 3 (T010)
2. **Validar**: Smoke tests 1–3 del quickstart.md
3. Módulo ya entrega valor — admin puede crear y consultar etiquetas

### Entrega Incremental

1. Phase 2: Base lista
2. Phase 3: Admin CRUD ✅
3. Phase 4: Ciclo de vida ✅
4. Phase 5: Portal público ✅
5. Phase 6: Soft delete ✅
6. Phase 7: Verificación final

---

## Notes

- Módulo idéntico a `categorias-menu` — todos los patrones son los mismos
- Alias QB: `'em'` (no `'cm'`)
- Campo `activa` (femenino) — NO `activo`
- Sin query params en endpoint público
- Sin PartialType en UpdateDto
- `etiqueta_menu.*` para audit actions (no `categoria_menu.*`)
