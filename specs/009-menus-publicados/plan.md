# Implementation Plan: Menús Publicados

**Branch**: `009-menus-publicados` | **Date**: 2026-06-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-menus-publicados/spec.md`

## Summary

Implementar el módulo `menus-publicados` (Type B) que representa la disponibilidad concreta de un menú base para un día determinado, con precio, sede, puntos de retiro y condiciones comerciales. El módulo expone endpoints de gestión en el back office (con lifecycle de estados: activo → pausado/cerrado/agotado/cancelado) y un endpoint público para que los clientes consulten menús disponibles. Extiende `BaseCrudTenantService<MenuPublicado>` con lógica de negocio propia sobre la máquina de estados y validaciones cross-entity (menu base activo, sede activa, puntos de retiro válidos en sede). Audita todas las acciones mutativas vía `AuditService`. Exporta `MenusPublicadosService` para consumo futuro por pedidos y producción (Stage 3+).

## Technical Context

**Language/Version**: TypeScript 5.x con NestJS 10.x

**Primary Dependencies**: NestJS (decorators, guards, DI), TypeORM (QB, M2M join table, soft delete), class-validator / class-transformer (DTOs)

**Storage**: PostgreSQL — tabla `menus_publicados` + join table `menu_publicado_puntos_retiro` + enums PG (`estado_menu_publicado`, `tipo_sobreproduccion`)

**Testing**: Manual via HTTP client (patrón del proyecto; no hay test suite automatizada configurada en este stage)

**Target Platform**: NestJS backend sobre Railway (Node.js)

**Performance Goals**: Listado admin < 2s con 200 registros. Portal público < 1s con filtros aplicados.

**Constraints**:
- Multi-tenancy estricta: toda query con `tenant_id` scope — `getTenantId({ strictTenant: true })`
- No `repo.find()` sin scope de tenant
- No `throw new Error()` — solo `AppError`
- Auditoría en el controlador (patrón establecido en menus-base)
- `cancelar()` recibe `rolUsuario` del controlador para validar transición desde `cerrado`/`agotado`

**Scale/Scope**: Multi-tenant SaaS; volumen estimado: < 1000 menús publicados por tenant

## Constitution Check

*GATE: Validación pre-implementación*

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | PASS | Usa `ok()` / `page()` de `api-response.ts`. `AppError` para errores de negocio. |
| II. Multi-Tenancy by Default | PASS | Todas las queries con `getTenantId({ strictTenant: true })`. Endpoint público usa `x-tenant-key` → `TenancyModule`. |
| III. Role-Based Access Control | PASS | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` en todos los endpoints admin. Endpoint público explícitamente no guardado (anotado). |
| IV. Business Rule Integrity | PASS | Máquina de estados con transiciones estrictas. Validación de precio > 0, fecha límite ≤ fecha venta, sobreproducción coherente. |
| V. Audit Trail | PASS | Audita: crear, editar, pausar, reactivar, cerrar, agotar, cancelar, eliminar. Audit en el controlador con `AuditService.write()`. |
| VI. Module Architecture | PASS | Estructura: `entities/`, `dto/`, service, 2 controllers, module. Extiende `BaseCrudTenantService`. No circular deps. |
| VII. Implementation Discipline | PASS | Stage 2 — `menus-publicados` es el segundo módulo del stage (después de `menus-base` ✅). |

**Constitution violations**: ninguna.

## Project Structure

### Documentation (this feature)

```text
specs/009-menus-publicados/
├── plan.md              ← Este archivo
├── spec.md              ← Especificación funcional
├── research.md          ← Decisiones de diseño resueltas
├── data-model.md        ← Entidad, relaciones, máquina de estados
├── contracts/
│   └── api.md           ← Contratos REST (request/response shapes)
├── checklists/
│   └── requirements.md  ← Checklist de calidad del spec
└── tasks.md             ← (generado por /speckit-tasks)
```

### Source Code

```text
src/modules/menus-publicados/
├── entities/
│   └── menu-publicado.entity.ts        ← MenuPublicado, enums EstadoMenuPublicado y TipoSobreproduccion
├── dto/
│   ├── create-menu-publicado.dto.ts    ← Validación de creación con puntos_retiro_ids
│   ├── update-menu-publicado.dto.ts    ← Partial de create (sin menu_base_id, sede_id, fecha_venta)
│   ├── query-menu-publicado.dto.ts     ← Extiende PageQueryDto, agrega fecha_venta/sede_id/estado/menu_base_id
│   └── query-menus-disponibles.dto.ts  ← sede_id (required) + punto_retiro_id (optional)
├── menus-publicados.service.ts         ← Lógica de negocio, transiciones de estado, validaciones cross-entity
├── menus-publicados.controller.ts      ← /admin/menus-publicados — todos los endpoints admin con auditoría
├── public-menus-publicados.controller.ts ← /public/menus-disponibles — sin auth
└── menus-publicados.module.ts          ← Imports, providers, exports

src/common/errors/error-codes.ts       ← Agregar 7 nuevos códigos MENU_PUBLICADO_*
src/app.module.ts                      ← Registrar MenusPublicadosModule
```

---

## Phase 0: Research

**Status**: COMPLETE. Ver [research.md](research.md).

Decisiones clave:
1. Auditoría en controlador (patrón menus-base)
2. `cancelar()` recibe rol del controlador; lógica de estado es business rule, no guard
3. Validación de puntos de retiro via QB directo sobre `Repository<PuntoRetiro>`
4. Horizonte público de 7 días (constante `DIAS_HORIZONTE_PUBLICO = 7`)
5. Comparación fecha: `fecha_hora_limite_encargo <= fecha_venta + T23:59:59Z`

---

## Phase 1: Design & Contracts

**Status**: COMPLETE.

- [data-model.md](data-model.md) — Entidad, relaciones, máquina de estados, índices, error codes
- [contracts/api.md](contracts/api.md) — Contratos REST completos: request bodies, response shapes, errores por endpoint

---

## Implementation Guide

### Step 1 — Error codes

Agregar en `src/common/errors/error-codes.ts` bajo la sección `// menus-publicados`:

```typescript
// menus-publicados
MENU_PUBLICADO_NOT_FOUND: 'MENU_PUBLICADO_NOT_FOUND',
MENU_PUBLICADO_TRANSICION_INVALIDA: 'MENU_PUBLICADO_TRANSICION_INVALIDA',
MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS: 'MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS',
MENU_PUBLICADO_PRECIO_INVALIDO: 'MENU_PUBLICADO_PRECIO_INVALIDO',
MENU_PUBLICADO_FECHA_LIMITE_INVALIDA: 'MENU_PUBLICADO_FECHA_LIMITE_INVALIDA',
MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA: 'MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA',
MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE: 'MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE',
```

---

### Step 2 — Entity

`src/modules/menus-publicados/entities/menu-publicado.entity.ts`

- Definir enums `EstadoMenuPublicado` y `TipoSobreproduccion` en el mismo archivo o en sibling `menu-publicado.enums.ts`
- Extender `BaseEntity`
- Decorador `@Entity('menus_publicados')`
- `@ManyToOne(() => MenuBase) @JoinColumn({ name: 'menu_base_id' })` — carga lazy
- `@ManyToOne(() => Sede) @JoinColumn({ name: 'sede_id' })` — carga lazy
- `@ManyToMany(() => PuntoRetiro) @JoinTable({ name: 'menu_publicado_puntos_retiro', joinColumn: { name: 'menu_publicado_id' }, inverseJoinColumn: { name: 'punto_retiro_id' } })`
- Habilitar soft delete: TypeORM lo detecta automáticamente por `@DeleteDateColumn` en `BaseEntity`

Índices adicionales (via `@Index` en class level):
```typescript
@Index('idx_mp_tenant_fecha', ['tenant_id', 'fecha_venta'])
@Index('idx_mp_tenant_sede_estado', ['tenant_id', 'sede_id', 'estado'])
```

---

### Step 3 — DTOs

**`create-menu-publicado.dto.ts`**: Ver campos en [contracts/api.md](contracts/api.md#createmenupublicadodto).

**`update-menu-publicado.dto.ts`**: `PartialType` de `CreateMenuPublicadoDto` sin `menu_base_id`, `sede_id`, `fecha_venta`. Si `puntos_retiro_ids` viene, agregar `@ArrayMinSize(1)`.

**`query-menu-publicado.dto.ts`**: Extiende `PageQueryDto` (o `SortQueryDto`). Agregar:
```typescript
@IsOptional() @IsDateString() fecha_venta?: string;
@IsOptional() @IsUUID() sede_id?: string;
@IsOptional() @IsEnum(EstadoMenuPublicado) estado?: EstadoMenuPublicado;
@IsOptional() @IsUUID() menu_base_id?: string;
```

**`query-menus-disponibles.dto.ts`**:
```typescript
@IsUUID() @IsNotEmpty() sede_id: string;
@IsOptional() @IsUUID() punto_retiro_id?: string;
```

---

### Step 4 — Service

`src/modules/menus-publicados/menus-publicados.service.ts`

Constructor inyecta:
- `@InjectRepository(MenuPublicado) private readonly mpRepo: Repository<MenuPublicado>`
- `@InjectRepository(PuntoRetiro) private readonly puntoRetiroRepo: Repository<PuntoRetiro>`
- `private readonly menusBaseService: MenusBaseService`
- `private readonly sedesService: SedesService`

**`create(dto)`**:
1. `const tenantId = this.getTenantId({ strictTenant: true })`
2. `await this.menusBaseService.findOne(dto.menu_base_id)` → verifica existencia y `activo=true` (lanza si no)
3. `await this.sedesService.findOne(dto.sede_id)` → verifica existencia y `activa=true` (lanza si no)
4. `this.assertPrecioValido(dto.precio_encargo)`
5. `this.assertFechaLimiteValida(dto.fecha_hora_limite_encargo, dto.fecha_venta)`
6. `this.assertSobreproduccionCoherente(dto.tipo_sobreproduccion, dto.valor_sobreproduccion)`
7. `const puntosRetiro = await this.assertPuntosRetiroValidos(dto.puntos_retiro_ids, dto.sede_id)`
8. Crear y guardar entidad con `estado = EstadoMenuPublicado.ACTIVO`
9. Return `this.findOne(saved.id)`

**`update(id, dto)`**:
1. `const mp = await this.findOne(id)`
2. Si `dto.precio_encargo` → `assertPrecioValido`
3. Si `dto.fecha_hora_limite_encargo` → `assertFechaLimiteValida(..., mp.fecha_venta)`
4. Si `dto.tipo_sobreproduccion` o `dto.valor_sobreproduccion` → `assertSobreproduccionCoherente`
5. Si `dto.puntos_retiro_ids` → `assertPuntosRetiroValidos(dto.puntos_retiro_ids, mp.sede_id)` → asignar
6. Aplicar todos los campos opcionales no undefined
7. Guardar y retornar `findOne(id)`

**`findOne(id)`**:
```typescript
const mp = await this.mpRepo.createQueryBuilder('mp')
  .where('mp.id = :id', { id })
  .andWhere('mp.tenant_id = :tenantId', { tenantId })
  .andWhere('mp.deleted_at IS NULL')
  .leftJoinAndSelect('mp.menuBase', 'mb')
  .leftJoinAndSelect('mb.categorias', 'cat')
  .leftJoinAndSelect('mb.etiquetas', 'et')
  .leftJoinAndSelect('mb.alergenos', 'al')
  .leftJoinAndSelect('mp.sede', 'sede')
  .leftJoinAndSelect('mp.puntosRetiro', 'pr')
  .getOne();
if (!mp) throw AppError MENU_PUBLICADO_NOT_FOUND;
return mp;
```

**`list(query)`**:
```typescript
const qb = this.mpRepo.createQueryBuilder('mp')
  .where('mp.tenant_id = :tenantId', { tenantId })
  .andWhere('mp.deleted_at IS NULL')
  .leftJoinAndSelect('mp.menuBase', 'mb')
  .leftJoinAndSelect('mp.puntosRetiro', 'pr');
if (query.fecha_venta) qb.andWhere('mp.fecha_venta = :fv', { fv: query.fecha_venta });
if (query.sede_id) qb.andWhere('mp.sede_id = :sedeId', { sedeId: query.sede_id });
if (query.estado) qb.andWhere('mp.estado = :estado', { estado: query.estado });
if (query.menu_base_id) qb.andWhere('mp.menu_base_id = :mbId', { mbId: query.menu_base_id });
// sort, paginate
```

**Métodos de transición de estado**:

```typescript
async pausar(id: string): Promise<MenuPublicado> {
  const mp = await this.findOne(id);
  if (mp.estado !== EstadoMenuPublicado.ACTIVO)
    throw AppError MENU_PUBLICADO_TRANSICION_INVALIDA;
  mp.estado = EstadoMenuPublicado.PAUSADO;
  return this.mpRepo.save(mp);
}

async reactivar(id: string): Promise<MenuPublicado> {
  const mp = await this.findOne(id);
  if (mp.estado !== EstadoMenuPublicado.PAUSADO)
    throw AppError MENU_PUBLICADO_TRANSICION_INVALIDA;
  mp.estado = EstadoMenuPublicado.ACTIVO;
  return this.mpRepo.save(mp);
}

async cerrar(id: string): Promise<MenuPublicado> {
  const mp = await this.findOne(id);
  const allowed = [EstadoMenuPublicado.ACTIVO, EstadoMenuPublicado.PAUSADO];
  if (!allowed.includes(mp.estado)) throw AppError MENU_PUBLICADO_TRANSICION_INVALIDA;
  mp.estado = EstadoMenuPublicado.CERRADO;
  return this.mpRepo.save(mp);
}

async agotar(id: string): Promise<MenuPublicado> {
  const mp = await this.findOne(id);
  if (mp.estado !== EstadoMenuPublicado.ACTIVO)
    throw AppError MENU_PUBLICADO_TRANSICION_INVALIDA;
  mp.estado = EstadoMenuPublicado.AGOTADO;
  return this.mpRepo.save(mp);
}

async cancelar(id: string, rolUsuario: string): Promise<MenuPublicado> {
  const mp = await this.findOne(id);
  if (mp.estado === EstadoMenuPublicado.CANCELADO)
    throw AppError MENU_PUBLICADO_TRANSICION_INVALIDA;
  const soloAdmin = [EstadoMenuPublicado.CERRADO, EstadoMenuPublicado.AGOTADO];
  if (soloAdmin.includes(mp.estado) && rolUsuario !== 'administrador')
    throw AppError MENU_PUBLICADO_TRANSICION_INVALIDA (con detalles de rol insuficiente);
  mp.estado = EstadoMenuPublicado.CANCELADO;
  return this.mpRepo.save(mp);
}
```

**`remove(id)`**:
```typescript
const mp = await this.findOne(id);
if (mp.estado !== EstadoMenuPublicado.CANCELADO)
  throw AppError MENU_PUBLICADO_SOLO_CANCELADO_PUEDE_ELIMINARSE;
await this.mpRepo.softDelete(id);
```

**`listDisponiblesPublic(query)`**:
```typescript
const hoy = new Date(); hoy.setUTCHours(0,0,0,0);
const limite = new Date(hoy); limite.setDate(hoy.getDate() + DIAS_HORIZONTE_PUBLICO);

const qb = this.mpRepo.createQueryBuilder('mp')
  .where('mp.tenant_id = :tenantId', { tenantId })
  .andWhere('mp.deleted_at IS NULL')
  .andWhere('mp.estado = :estado', { estado: EstadoMenuPublicado.ACTIVO })
  .andWhere('mp.sede_id = :sedeId', { sedeId: query.sede_id })
  .andWhere('mp.fecha_venta >= :hoy', { hoy })
  .andWhere('mp.fecha_venta <= :limite', { limite })
  .leftJoinAndSelect('mp.menuBase', 'mb')
  .leftJoinAndSelect('mb.categorias', 'cat')
  .leftJoinAndSelect('mb.etiquetas', 'et')
  .leftJoinAndSelect('mb.alergenos', 'al')
  .leftJoinAndSelect('mp.puntosRetiro', 'pr')
  .orderBy('mp.fecha_venta', 'ASC')
  .addOrderBy('mb.nombre', 'ASC');

if (query.punto_retiro_id) {
  qb.innerJoin('mp.puntosRetiro', 'prf', 'prf.id = :prId', { prId: query.punto_retiro_id });
}

return qb.getMany();
```

**Private helpers**:
- `assertPrecioValido(precio)` → si `precio <= 0` lanzar `MENU_PUBLICADO_PRECIO_INVALIDO`
- `assertFechaLimiteValida(fechaLimite, fechaVenta)` → comparar `new Date(fechaLimite) > new Date(fechaVenta + 'T23:59:59Z')` → lanzar `MENU_PUBLICADO_FECHA_LIMITE_INVALIDA`
- `assertSobreproduccionCoherente(tipo, valor)` → si uno presente y el otro no → `MENU_PUBLICADO_SOBREPRODUCCION_INVALIDA`
- `assertPuntosRetiroValidos(ids, sedeId)` → QB loop por id con `tenant_id`, `activo=true`, `sede_id=sedeId` → lanzar `MENU_PUBLICADO_PUNTOS_RETIRO_INVALIDOS`

---

### Step 5 — Admin Controller

`src/modules/menus-publicados/menus-publicados.controller.ts`

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/menus-publicados')
export class MenusPublicadosController {
  constructor(
    private readonly svc: MenusPublicadosService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}
  // Endpoints: GET /, GET /:id, POST /, PATCH /:id,
  //            PATCH /:id/pausar, PATCH /:id/reactivar, PATCH /:id/cerrar,
  //            PATCH /:id/agotar, PATCH /:id/cancelar, DELETE /:id
}
```

Patrón de auditoría (igual que MenusBaseController):
```typescript
const auditData = auditLogPayload({ requestId: req.id, actorUserId: req.user?.sub,
  actorEmail: req.user?.email, action: 'menu_publicado.created',
  entity: 'menu_publicado', extra: { menuPublicadoId: mp.id } });
this.logger.info(auditData, 'admin_audit');
await this.audit.write('admin', { request_id: req.id, method: req.method,
  path: req.url, status_code: 201, actor_user_id: req.user?.sub ?? null,
  actor_email: req.user?.email ?? null, action: 'menu_publicado.created',
  entity: 'menu_publicado', payload: auditData });
```

Para `cancelar`: extraer rol con `req.user?.rol` (o la propiedad que usa el JWT en este proyecto) y pasarlo a `svc.cancelar(id, rolUsuario)`.

---

### Step 6 — Public Controller

`src/modules/menus-publicados/public-menus-publicados.controller.ts`

```typescript
@Controller('public/menus-disponibles')
export class PublicMenusPublicadosController {
  constructor(private readonly svc: MenusPublicadosService) {}

  @Get()
  async listDisponibles(@Query() query: QueryMenusDisponiblesDto) {
    const menus = await this.svc.listDisponiblesPublic(query);
    return ok(menus);
  }
}
```

Sin guards, sin auditoría. El `TenancyModule` ya intercepta `x-tenant-key` via middleware global.

---

### Step 7 — Module

`src/modules/menus-publicados/menus-publicados.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([MenuPublicado, MenuBase, Sede, PuntoRetiro]),
    MenusBaseModule,
    SedesModule,
    PuntosRetiroModule,
    AuditModule,
  ],
  providers: [MenusPublicadosService],
  controllers: [MenusPublicadosController, PublicMenusPublicadosController],
  exports: [MenusPublicadosService],
})
export class MenusPublicadosModule {}
```

---

### Step 8 — App Module

Agregar en `src/app.module.ts`:

```typescript
import { MenusPublicadosModule } from './modules/menus-publicados/menus-publicados.module';
// ...
MenusPublicadosModule,  // ← en el array imports, después de MenusBaseModule
```

---

### Step 9 — Migration

```bash
npm run db:migration:generate -- migrations/CreateMenusPublicados
```

Verificar que la migración generada incluya:
- Tabla `menus_publicados` con todos los campos y enums PostgreSQL
- Tabla intermedia `menu_publicado_puntos_retiro` con FKs a `menus_publicados` y `puntos_retiro`
- Índices `idx_mp_tenant_fecha` e `idx_mp_tenant_sede_estado`
- `deleted_at` nullable para soft delete

Los enums PostgreSQL (`estado_menu_publicado`, `tipo_sobreproduccion`) se crean automáticamente por TypeORM. `migrationsRun: true` ya está configurado.

---

## Open Questions / Risks

| Item | Risk | Mitigation |
|------|------|-----------|
| Propiedad del rol en JWT | El controlador extrae `req.user?.rol` pero la propiedad exacta del JWT debe verificarse contra `src/common/types/express.d.ts` | Verificar antes de implementar `cancelar()` |
| `SedesService.findOne()` verifica `activa` | Debe confirmarse que el método lanza error si la sede no está activa, no solo si no existe | Revisar implementación de `SedesService.findOne()` |
| `MenusBaseService.findOne()` verifica `activo` | Idem para menú base | Revisar — si no, agregar check explícito post-fetch |
