---
description: "Task list for banners-promociones module — Type A CRUD tenant-safe con lógica de fechas"
---

# Tasks: Módulo Banners y Promociones

**Input**: Design documents from `specs/010-banners-promociones/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api-endpoints.md ✅, quickstart.md ✅

**Tests**: No se incluyen tareas de tests (no solicitadas en la spec).

**Organization**: Las tareas están agrupadas por historia de usuario para habilitar implementación y prueba independiente de cada historia. Las fases 1 y 2 son prerequisitos bloqueantes.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1–US3 del spec.md)

---

## Phase 1: Setup

**Purpose**: Preparar la infraestructura compartida del módulo antes de cualquier historia de usuario.

- [x] T001 Agregar 5 códigos de error en `src/common/errors/error-codes.ts`: `BANNER_NOT_FOUND`, `BANNER_YA_ACTIVO`, `BANNER_YA_INACTIVO`, `BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR`, `BANNER_FECHAS_INVALIDAS`
- [x] T002 Crear estructura de directorios `src/modules/banners-promociones/entities/` y `src/modules/banners-promociones/dto/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Entidad, migración, DTOs y servicio base que TODAS las historias de usuario requieren.

**⚠️ CRÍTICO**: Ninguna historia de usuario puede implementarse hasta que esta fase esté completa.

- [x] T003 [P] Crear entidad `Banner` en `src/modules/banners-promociones/entities/banner.entity.ts` — `@Entity('banners_promociones')`; `@Index('idx_banners_tenant_activo', ['tenant_id','activo'])`; extiende `BaseEntity`; campos: `titulo varchar(200)`, `descripcion text nullable`, `imagen_public_id varchar(500) nullable`, `imagen_url varchar(1000) nullable`, `url_destino varchar(500) nullable`, `activo boolean default true`, `orden_visualizacion int nullable`, `fecha_inicio date nullable`, `fecha_fin date nullable`; `@DeleteDateColumn` para soft delete; fechas tipadas como `string | null`
- [x] T004 [P] Crear `CreateBannerDto` en `src/modules/banners-promociones/dto/create-banner.dto.ts` — `titulo` (`@IsString @IsNotEmpty @MaxLength(200)`), `descripcion` (`@IsOptional @IsString`), `imagen_public_id` (`@IsOptional @IsString @MaxLength(500)`), `imagen_url` (`@IsOptional @IsUrl @MaxLength(1000)`), `url_destino` (`@IsOptional @IsString @MaxLength(500)`), `activo` (`@IsOptional @IsBoolean`), `orden_visualizacion` (`@IsOptional @Type(()=>Number) @IsInt @Min(1)`), `fecha_inicio` (`@IsOptional @IsDateString`), `fecha_fin` (`@IsOptional @IsDateString`)
- [x] T005 [P] Crear `UpdateBannerDto` en `src/modules/banners-promociones/dto/update-banner.dto.ts` — mismos campos que Create pero todos con `@IsOptional`; declarar explícitamente sin `PartialType`; incluir `titulo` con `@IsOptional @IsString @IsNotEmpty @MaxLength(200)`
- [x] T006 [P] Crear `QueryBannerDto` en `src/modules/banners-promociones/dto/query-banner.dto.ts` — extiende `PageQueryDto`; agrega `activo` (`@IsOptional @Transform @IsBoolean`), `sortBy` (`@IsOptional @IsIn(['orden_visualizacion','created_at'])`), `sortOrder` (`@IsOptional @IsIn(['ASC','DESC'])`)
- [x] T007 Generar migración con `npm run db:migration:generate -- migrations/CreateBanners` y verificar que el archivo generado incluye: tabla `banners_promociones` con todos los campos, índice `idx_banners_tenant_activo` en `(tenant_id, activo)`, y el método `down()` elimina índice y tabla en orden correcto; NO requiere edición manual de índice único parcial (no existe) (depende de T003)
- [x] T008 Implementar la base de `BannersPromocionesService` en `src/modules/banners-promociones/banners-promociones.service.ts` — clase `BannersPromocionesService extends BaseCrudTenantService<Banner>`; constructor con `@InjectRepository(Banner) private readonly bannerRepo`; método privado `validateFechas(fechaInicio: string|null, fechaFin: string|null)` que lanza `BANNER_FECHAS_INVALIDAS 422` si `new Date(fechaInicio) > new Date(fechaFin)`; método `findOne(id)` con `findById` + throw `BANNER_NOT_FOUND 404` (depende de T003, T001)
- [x] T009 Crear `BannersPromocionesModule` en `src/modules/banners-promociones/banners-promociones.module.ts` — `TypeOrmModule.forFeature([Banner])`, imports: `[AuditModule]`, providers: `[BannersPromocionesService]`, exports: `[BannersPromocionesService]`; luego importar `BannersPromocionesModule` en `src/app.module.ts` (depende de T008)

**Checkpoint**: Entidad, DTOs, servicio base y módulo listos. `npm run start:dev` compila sin errores.

---

## Phase 3: User Story 1 + User Story 3 — Admin CRUD + Supervisor read-only (Priority: P1) 🎯 MVP

**US1 Goal**: El administrador puede crear, editar, activar, inactivar, eliminar y listar banners desde el back office.
**US3 Goal**: El supervisor puede consultar el listado y detalle de banners (read-only).

**Independent Test**: `POST /admin/banners` crea un banner y `GET /admin/banners` lo devuelve paginado. Fechas incoherentes devuelven `BANNER_FECHAS_INVALIDAS 422`. Banner activo no puede eliminarse. Supervisor puede listar pero recibe 403 al intentar crear.

### Implementación US1 + US3

- [x] T010 [US1] [US3] Agregar método `list(query: QueryBannerDto)` a `src/modules/banners-promociones/banners-promociones.service.ts` — construir `filters` con `activo` si viene definido; llamar `super.list()` con `sortAllowed: ['orden_visualizacion','created_at']`, `sortFallback: {by:'created_at',order:'DESC'}`, `filterAllowed: ['activo']`, `strictTenant: true`
- [x] T011 [US1] Agregar métodos `create(dto: CreateBannerDto)` y `update(id, dto: UpdateBannerDto)` a `src/modules/banners-promociones/banners-promociones.service.ts` — `create`: llamar `validateFechas(dto.fecha_inicio??null, dto.fecha_fin??null)` → `super.create(dto, {strictTenant:true})`; `update`: llamar `findOne(id)` → resolver fechas efectivas combinando DTO con valores existentes en DB (`dto.fecha_inicio !== undefined ? dto.fecha_inicio : existing.fecha_inicio`) → `validateFechas(...)` → `super.update(id, dto, {strictTenant:true})`
- [x] T012 [US1] Agregar métodos `activar(id)` e `inactivar(id)` a `src/modules/banners-promociones/banners-promociones.service.ts` — `activar`: `findOne` → si `activo===true` throw `BANNER_YA_ACTIVO 409` → `banner.activo=true` → `bannerRepo.save(banner)`; `inactivar`: `findOne` → si `!activo` throw `BANNER_YA_INACTIVO 409` → `banner.activo=false` → `bannerRepo.save(banner)`
- [x] T013 [US1] Agregar método `remove(id)` a `src/modules/banners-promociones/banners-promociones.service.ts` — `findOne` → si `activo===true` throw `BANNER_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR 409` → `super.softDelete(id, {strictTenant:true})`
- [x] T014 [US1] [US3] Implementar `BannersPromocionesController` en `src/modules/banners-promociones/banners-promociones.controller.ts` — `@Controller('admin/banners')` con `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel clase; `GET /` `@Roles('administrador','supervisor')` retorna `page(items,...)`; `GET /:id` `@Roles('administrador','supervisor')` retorna `ok(banner)`; `POST /` `@Roles('administrador')` `@HttpCode(201)` llama `svc.create` + `AuditService.write(auditLogPayload('banner.created',...))` + retorna `ok(banner)`; `PATCH /:id` `@Roles('administrador')` llama `svc.update` + audit `banner.updated` + retorna `ok(banner)`; `PATCH /:id/activar` `@Roles('administrador')` llama `svc.activar` + audit `banner.activated` + retorna `ok(banner)`; `PATCH /:id/inactivar` `@Roles('administrador')` llama `svc.inactivar` + audit `banner.deactivated` + retorna `ok(banner)`; `DELETE /:id` `@Roles('administrador')` llama `svc.remove` + audit `banner.deleted` + retorna `ok({id})` (depende de T009, T010, T011, T012, T013)

**Checkpoint**: Smoke tests 1–7 y 11 del `specs/010-banners-promociones/quickstart.md` pasan. Administrador puede realizar el CRUD completo. Supervisor puede listar pero recibe 403 al intentar crear.

---

## Phase 4: User Story 2 — Portal público (Priority: P1)

**Goal**: Los visitantes del portal pueden ver todos los banners activos y vigentes del tenant sin autenticación, ordenados por posición.

**Independent Test**: `GET /public/banners` con header `x-tenant-key` devuelve solo banners activos y dentro de rango de fechas, ordenados por `orden_visualizacion ASC NULLS LAST`, desempate por `created_at DESC`. Banners inactivos o fuera de rango NO aparecen. Sin `x-tenant-key` devuelve error `TENANT_REQUIRED`.

### Implementación US2

- [x] T015 [US2] Agregar método `listPublic()` a `src/modules/banners-promociones/banners-promociones.service.ts` — QB propio: `bannerRepo.createQueryBuilder('b')` + `applyTenantScopeQb(qb,'b',{strictTenant:true})` + `andWhere('b.activo = true')` + `andWhere('(b.fecha_inicio IS NULL OR b.fecha_inicio <= :hoy)', {hoy})` + `andWhere('(b.fecha_fin IS NULL OR b.fecha_fin >= :hoy)', {hoy})` + `.orderBy('b.orden_visualizacion','ASC','NULLS LAST')` + `.addOrderBy('b.created_at','DESC')` + `.getMany()`; donde `hoy = new Date().toISOString().split('T')[0]`
- [x] T016 [US2] Crear `PublicBannersController` en `src/modules/banners-promociones/public-banners.controller.ts` — `@Controller('public/banners')` SIN `JwtAuthGuard`; `@Get()` llama `svc.listPublic()` retorna `ok(banners)`; registrar en `BannersPromocionesModule.controllers` junto al admin controller (depende de T015, T009)

**Checkpoint**: Smoke tests 8–10 del `specs/010-banners-promociones/quickstart.md` pasan. Banners fuera de rango de fechas NO aparecen. Lista vacía si no hay banners activos.

---

## Phase 5: Polish & Verificación Final

**Purpose**: Validar el módulo completo antes de considerarlo entregado.

- [x] T017 Ejecutar `npm run build` y verificar que el proyecto compila sin errores TypeScript ni advertencias de tipos
- [ ] T018 Ejecutar todos los smoke tests del `specs/010-banners-promociones/quickstart.md` (tests 1–12) contra el servidor en local y confirmar que todos pasan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Setup completo — BLOQUEA todas las historias de usuario
- **US1+US3 (Phase 3)**: Depende de Phase 2 completa
- **US2 (Phase 4)**: Depende de Phase 2 completa; puede ejecutarse en paralelo con Phase 3 (T015 es un nuevo método en el service, T016 es un archivo separado)
- **Polish (Phase 5)**: Depende de todas las historias completas

### User Story Dependencies

- **US1+US3 (P1)**: Puede comenzar después de Phase 2 — core MVP
- **US2 (P1)**: Puede comenzar después de Phase 2 — `listPublic()` y `PublicBannersController` son independientes del admin controller

### Within Each Phase

- DTOs y entidad (T003–T006) pueden ejecutarse en paralelo
- Migración (T007) espera la entidad (T003)
- Service base (T008) espera entidad + ErrorCodes (T003, T001)
- Module + AppModule (T009) espera service base (T008)
- En Phase 3: métodos de service (T010–T013) pueden trabajarse en secuencia antes del controller (T014)
- En Phase 4: T015 (método en service) antes de T016 (controller que lo llama)

---

## Parallel Opportunities

```
Phase 1:
  T001 ──┐
  T002 ──┘ (ambos sin dependencias)

Phase 2:
  T003 ──┐
  T004 ──┤ (en paralelo — archivos distintos)
  T005 ──┤
  T006 ──┘
  T007 ── (espera T003)
  T008 ── (espera T001, T003)
  T009 ── (espera T008)

Después de Phase 2:
  Phase 3 (T010→T011→T012→T013→T014) ──┐
  Phase 4 (T015→T016)                 ──┘ (pueden comenzar en paralelo)
```

---

## Implementation Strategy

### MVP First (US1 + US3 únicamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloquea todo)
3. Completar Phase 3: US1 + US3 (admin CRUD completo + supervisor read-only)
4. **PARAR Y VALIDAR**: Probar smoke tests 1–7 y 11 del quickstart.md
5. El módulo ya entrega valor — el administrador puede gestionar banners desde el back office

### Entrega Incremental

1. Setup + Foundational → Base lista
2. Phase 3 (US1+US3) → MVP: admin puede gestionar banners ✅
3. Phase 4 (US2) → Portal público visible para clientes ✅
4. Phase 5 → Verificación final y entrega

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes en esa fase
- `[Story]` mapea la tarea a su historia de usuario para trazabilidad
- Campo es `activo` (masculino) — diferente de `activa` en categorias-menu
- Sin índice único en título — NO implementar `assertNombreUnico()`
- `validateFechas()` debe llamarse en `create()` Y en `update()` (update con valores combinados del DTO y DB)
- `listPublic()` usa QB propio con `IS NULL OR` — NO filtrar en memoria
- `NULLS LAST` en `.orderBy()` requiere pasar `'NULLS LAST'` como tercer argumento en TypeORM QB
- No usar `throw new Error()` — solo `AppError` con `ErrorCodes`
- No usar `repo.find()` sin scope de tenant
- Todas las respuestas via `ok()` y `page()` de `api-response.ts`
- Las operaciones mutantes del controller admin requieren `@Req() req` para la auditoría (mismo patrón que módulos anteriores)
- `migrationsRun: true` ya configurado — no tocar la config de DB
