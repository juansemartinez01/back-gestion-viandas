# Implementation Plan: Módulo Alérgenos

**Branch**: `006-alergenos-crud` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-alergenos-crud/spec.md`

## Summary

Implementar el módulo `alergenos` (Stage 1, quinto módulo de Master Data) para el sistema Rochester de gestión de viandas. Un alérgeno identifica un componente sensible presente en los menús (Gluten, Lactosa, Frutos secos, etc.) y es visible en el portal público para informar al cliente. El módulo es Type A — sin FK a otras entidades, sin dependencias de otros módulos en Stage 1. Diferencias clave respecto a categorias-menu y etiquetas-menu: campo `activo` (masculino, igual que sedes/puntos-retiro), sin `orden_visualizacion`, endpoint público ordena solo por `nombre ASC`.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, nestjs-pino

**Storage**: PostgreSQL 15+ via TypeORM (`DataSource`, `Repository`, `QueryBuilder`)

**Target Platform**: Railway (prod) / localhost (dev)

**Project Type**: REST API — módulo de catálogo tenant-safe dentro del Innoview Backend Template

**Performance Goals**: Listados < 2 segundos con hasta 500 registros por tenant; endpoint público < 500ms p95

**Constraints**: Sin `synchronize: true`. Sin `throw new Error()`. Sin `repo.find()` sin scope de tenant. Campo `activo` (masculino) — diferente de `activa` en categorias-menu y etiquetas-menu. Sin `orden_visualizacion`.

**Scale/Scope**: Múltiples tenants, < 30 alérgenos por tenant en MVP.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ | Usa `ok()`, `page()`, `AppError`, `ErrorCodes` |
| II. Multi-Tenancy by Default | ✅ | `BaseCrudTenantService`, `applyTenantScopeQb`, endpoint público vía `x-tenant-key` |
| III. RBAC | ✅ | `JwtAuthGuard + RolesGuard` a nivel clase; `@Roles()` por método; endpoint público explícito sin guard |
| IV. Business Rule Integrity | ✅ | Unicidad (tenant+nombre), soft delete solo si inactivo, advertencia informativa al inactivar |
| V. Audit Trail | ✅ | `AuditService.write()` en crear, editar, activar, inactivar, eliminar |
| VI. Module Architecture | ✅ | Type A — extends `BaseCrudTenantService`; estructura entity/dto/service/controller/module |
| VII. Implementation Discipline | ✅ | Stage 1, quinto módulo: sedes → puntos-retiro → categorias-menu → etiquetas-menu → alergenos |

**Resultado**: 7/7 ✅ — sin violaciones. Sin `Complexity Tracking` necesario.

## Project Structure

### Documentation (this feature)

```text
specs/006-alergenos-crud/
├── plan.md              # Este archivo
├── research.md          # Findings técnicos
├── data-model.md        # Entidad, DTOs, estado
├── quickstart.md        # Smoke tests + comandos
├── contracts/
│   └── api-endpoints.md # 8 endpoints con contratos completos
└── tasks.md             # Generado por /speckit-tasks
```

### Source Code

```text
src/
├── common/
│   └── errors/
│       └── error-codes.ts          # +5 nuevos códigos ALERGENO_*
├── modules/
│   └── alergenos/
│       ├── entities/
│       │   └── alergeno.entity.ts
│       ├── dto/
│       │   ├── create-alergeno.dto.ts
│       │   ├── update-alergeno.dto.ts
│       │   └── query-alergeno.dto.ts
│       ├── alergenos.service.ts
│       ├── alergenos.controller.ts
│       ├── public-alergenos.controller.ts
│       └── alergenos.module.ts
└── app.module.ts                    # Registrar AlergenosModule

migrations/
└── <timestamp>-CreateAlergenos.ts   # Generar + editar índice parcial
```

## Implementation Notes

### 1. ErrorCodes — agregar antes que cualquier otra cosa

```typescript
// src/common/errors/error-codes.ts — agregar al objeto ErrorCodes:
// alergenos
ALERGENO_NOT_FOUND: 'ALERGENO_NOT_FOUND',
ALERGENO_NOMBRE_DUPLICADO: 'ALERGENO_NOMBRE_DUPLICADO',
ALERGENO_YA_ACTIVO: 'ALERGENO_YA_ACTIVO',
ALERGENO_YA_INACTIVO: 'ALERGENO_YA_INACTIVO',
ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
```

### 2. Entidad

```typescript
@Entity('alergenos')
@Index('UQ_alergenos_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class Alergeno extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}
```

> **Nota**: Campo `activo` (masculino) — diferente de `activa` en categorias-menu/etiquetas-menu. Sin `orden_visualizacion`. El `@Index` en la clase genera un índice completo; la migración debe reemplazarlo por un índice parcial con `WHERE deleted_at IS NULL`.

### 3. Migración — edición manual obligatoria

Después de `npm run db:migration:generate -- migrations/CreateAlergenos`, editar el archivo generado:

```typescript
// Reemplazar el índice único auto-generado por:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_alergenos_tenant_nombre"
  ON "alergenos" ("tenant_id", "nombre")
  WHERE "deleted_at" IS NULL
`);

// En down() usar:
await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_alergenos_tenant_nombre"`);
```

### 4. Service

```typescript
@Injectable()
export class AlergenosService extends BaseCrudTenantService<Alergeno> {
  constructor(
    @InjectRepository(Alergeno)
    private readonly alergenoRepo: Repository<Alergeno>,
  ) {
    super(alergenoRepo);
  }

  async list(query: QueryAlergenoDto) {
    const filters: Record<string, any> = {};
    if (query.activo !== undefined) filters.activo = query.activo;

    return super.list(
      { page: query.page, limit: query.limit, q: query.q, sortBy: query.sortBy, sortOrder: query.sortOrder, filters },
      {
        searchColumns: ['nombre'],
        sortAllowed: ['nombre', 'created_at'],
        sortFallback: { by: 'nombre', order: 'ASC' },
        filterAllowed: ['activo'],
        strictTenant: true,
      },
    );
  }

  async findOne(id: string): Promise<Alergeno> {
    const al = await this.findById(id, { strictTenant: true });
    if (!al) throw new AppError({ code: ErrorCodes.ALERGENO_NOT_FOUND, message: 'Alérgeno no encontrado', status: 404, details: { id } });
    return al;
  }

  async create(dto: CreateAlergenoDto): Promise<Alergeno> {
    await this.assertNombreUnico(dto.nombre);
    return super.create(dto as Partial<Alergeno>, { strictTenant: true });
  }

  async update(id: string, dto: UpdateAlergenoDto): Promise<Alergeno> {
    await this.findOne(id);
    if (dto.nombre !== undefined) await this.assertNombreUnico(dto.nombre, id);
    return super.update(id, dto as Partial<Alergeno>, { strictTenant: true });
  }

  async activar(id: string): Promise<Alergeno> {
    const al = await this.findOne(id);
    if (al.activo) throw new AppError({ code: ErrorCodes.ALERGENO_YA_ACTIVO, message: 'El alérgeno ya se encuentra activo', status: 409, details: { id } });
    al.activo = true;
    return this.alergenoRepo.save(al);
  }

  async inactivar(id: string): Promise<Alergeno> {
    const al = await this.findOne(id);
    if (!al.activo) throw new AppError({ code: ErrorCodes.ALERGENO_YA_INACTIVO, message: 'El alérgeno ya se encuentra inactivo', status: 409, details: { id } });
    // MVP: validación de menús base activos asociados es informativa — se implementa en Stage 2
    al.activo = false;
    return this.alergenoRepo.save(al);
  }

  async remove(id: string): Promise<void> {
    const al = await this.findOne(id);
    if (al.activo) throw new AppError({ code: ErrorCodes.ALERGENO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR, message: 'El alérgeno debe estar inactivo antes de poder eliminarse', status: 409, details: { id } });
    await super.softDelete(id, { strictTenant: true });
  }

  async listPublic(): Promise<Alergeno[]> {
    const qb = this.alergenoRepo.createQueryBuilder('al');
    this.applyTenantScopeQb(qb, 'al', { strictTenant: true });
    qb.andWhere('al.activo = true')
      .orderBy('al.nombre', 'ASC');
    return qb.getMany();
  }

  private async assertNombreUnico(nombre: string, excludeId?: string): Promise<void> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.alergenoRepo.createQueryBuilder('al')
      .where('LOWER(al.nombre) = LOWER(:nombre)', { nombre })
      .andWhere('al.tenant_id = :tenantId', { tenantId })
      .andWhere('al.deleted_at IS NULL');
    if (excludeId) qb.andWhere('al.id != :excludeId', { excludeId });
    const exists = await qb.getOne();
    if (exists) throw new AppError({ code: ErrorCodes.ALERGENO_NOMBRE_DUPLICADO, message: `Ya existe un alérgeno con el nombre "${nombre}"`, status: 409, details: { nombre } });
  }
}
```

### 5. Module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Alergeno]), AuditModule],
  providers: [AlergenosService],
  controllers: [AlergenosController, PublicAlergenosController],
  exports: [AlergenosService],
})
export class AlergenosModule {}
```

### 6. Controller público — orden solo por nombre

El endpoint público no requiere query params. Orden fijo: `nombre ASC` (sin `NULLS LAST` porque no hay `orden_visualizacion`).

```typescript
@Controller('public/alergenos')
export class PublicAlergenosController {
  constructor(private readonly svc: AlergenosService) {}

  @Get()
  async list() {
    const alergenos = await this.svc.listPublic();
    return ok(alergenos);
  }
}
```

### 7. UpdateAlergenoDto — sin PartialType

No usar `PartialType`. Declarar todos los campos explícitamente como opcionales.

### 8. QueryAlergenoDto — filtro `activo` (masculino)

El campo de filtro es `activo` (no `activa`). El DTO extiende `PageQueryDto` con `q`, `activo` (con `@Transform` bool), `sortBy`, `sortOrder`.

## Constraints Recap

| Constraint | Cómo se aplica |
|-----------|----------------|
| No `repo.find()` sin tenant | Siempre via `super.*()` o `applyTenantScopeQb()` |
| No `throw new Error()` | Solo `AppError` con `ErrorCodes` |
| Campo `activo` (masculino) | Distinto de `activa` en categorias-menu/etiquetas-menu — no mezclar |
| Sin `orden_visualizacion` | `sortAllowed: ['nombre', 'created_at']`; listPublic() solo ordena por nombre |
| QB alias `'al'` | Para alérgenos (no `'cm'` ni `'em'`) |
| Endpoint público sin query params | `listPublic()` sin argumentos; tenant resuelto por middleware |
| Respuestas via helpers | `ok()` y `page()` de `api-response.ts` |
| `migrationsRun: true` | Ya configurado — no tocar |
| Advertencia inactivar MVP | Solo comentario; bloqueo en Stage 2 cuando exista `menus-base` |
