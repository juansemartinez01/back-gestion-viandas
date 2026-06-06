# Implementation Plan: Gestión de Puntos de Retiro

**Branch**: `002-puntos-retiro` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-puntos-retiro/spec.md`

## Summary

Implementar el módulo `puntos-retiro` (Stage 1, segundo módulo de Master Data) para el sistema Rochester de gestión de viandas. Un punto de retiro es el lugar físico dentro de una sede donde el cliente retira su pedido o donde se realizan ventas presenciales. El módulo sigue exactamente el patrón del módulo `sedes` ya implementado, con las diferencias clave de: FK a `Sede`, unicidad compuesta `(tenant_id, sede_id, nombre)`, validación de sede activa al crear, y filtro por `sede_id` en el endpoint público.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, bcrypt, nestjs-pino

**Storage**: PostgreSQL 15+ via TypeORM (`DataSource`, `Repository`, `QueryBuilder`)

**Target Platform**: Railway (prod) / localhost (dev)

**Project Type**: REST API — módulo de catálogo tenant-safe dentro del Innoview Backend Template

**Performance Goals**: Listados < 2 segundos con hasta 500 registros; endpoint público < 1 segundo p95

**Constraints**: Sin `synchronize: true`. Sin `throw new Error()`. Sin `repo.find()` sin scope de tenant. `sede_id` inmutable en update.

**Scale/Scope**: Múltiples tenants, decenas de sedes por tenant, decenas de puntos de retiro por sede.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ | Usa `ok()`, `page()`, `AppError`, `ErrorCodes` |
| II. Multi-Tenancy by Default | ✅ | `BaseCrudTenantService`, `applyTenantScopeQb`, endpoint público vía `x-tenant-key` |
| III. RBAC | ✅ | `JwtAuthGuard + RolesGuard` a nivel clase; `@Roles()` por método; endpoint público explícito sin guard |
| IV. Business Rule Integrity | ✅ | Unicidad compuesta, sede activa requerida, soft delete solo si inactivo |
| V. Audit Trail | ✅ | `AuditService.write()` en crear, editar, activar, inactivar, eliminar |
| VI. Module Architecture | ✅ | Type A — extends `BaseCrudTenantService`; estructura entity/dto/service/controller/module |
| VII. Implementation Discipline | ✅ | Stage 1, segundo módulo después de `sedes` |

**Resultado**: 7/7 ✅ — sin violaciones. Sin `Complexity Tracking` necesario.

## Project Structure

### Documentation (this feature)

```text
specs/002-puntos-retiro/
├── plan.md              # Este archivo
├── research.md          # 10 findings técnicos
├── data-model.md        # Entidad, DTOs, estado
├── quickstart.md        # 7 smoke tests + comandos
├── contracts/
│   └── api-endpoints.md # 8 endpoints con contratos completos
└── tasks.md             # Generado por /speckit-tasks
```

### Source Code

```text
src/
├── common/
│   └── errors/
│       └── error-codes.ts          # +6 nuevos códigos PUNTO_RETIRO_* y SEDE_INACTIVA
├── modules/
│   └── puntos-retiro/
│       ├── entities/
│       │   └── punto-retiro.entity.ts
│       ├── dto/
│       │   ├── create-punto-retiro.dto.ts
│       │   ├── update-punto-retiro.dto.ts
│       │   └── query-punto-retiro.dto.ts
│       ├── puntos-retiro.service.ts
│       ├── puntos-retiro.controller.ts
│       ├── public-puntos-retiro.controller.ts
│       └── puntos-retiro.module.ts
└── app.module.ts                    # Registrar PuntosRetiroModule

migrations/
└── <timestamp>-CreatePuntosRetiro.ts  # Generar + editar índice parcial
```

## Implementation Notes

### 1. ErrorCodes — agregar antes que cualquier otra cosa

```typescript
// src/common/errors/error-codes.ts — agregar al objeto ErrorCodes:
// puntos-retiro
PUNTO_RETIRO_NOT_FOUND: 'PUNTO_RETIRO_NOT_FOUND',
PUNTO_RETIRO_NOMBRE_DUPLICADO: 'PUNTO_RETIRO_NOMBRE_DUPLICADO',
PUNTO_RETIRO_YA_ACTIVO: 'PUNTO_RETIRO_YA_ACTIVO',
PUNTO_RETIRO_YA_INACTIVO: 'PUNTO_RETIRO_YA_INACTIVO',
PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'PUNTO_RETIRO_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
// sedes (si no existe)
SEDE_INACTIVA: 'SEDE_INACTIVA',
```

### 2. Entidad — diferencias vs Sede

```typescript
@Entity('puntos_retiro')
@Index('UQ_puntos_retiro_tenant_sede_nombre', ['tenant_id', 'sede_id', 'nombre'], { unique: true })
export class PuntoRetiro extends BaseEntity {
  @Column({ type: 'uuid' })
  sede_id!: string;

  @ManyToOne(() => Sede, { eager: false })
  @JoinColumn({ name: 'sede_id' })
  sede?: Sede;

  @Column({ type: 'varchar', length: 150 })
  nombre!: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'int', nullable: true })
  orden_visualizacion!: number | null;

  @Column({ type: 'text', nullable: true })
  observaciones!: string | null;
}
```

> **Nota**: El `@Index` en la clase genera un índice completo. La migración debe reemplazarlo por el índice parcial con `WHERE deleted_at IS NULL`.

### 3. Migración — edición manual obligatoria

Después de `npm run db:migration:generate -- migrations/CreatePuntosRetiro`, editar el archivo generado:

```typescript
// Reemplazar el índice único auto-generado por:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_puntos_retiro_tenant_sede_nombre"
  ON "puntos_retiro" ("tenant_id", "sede_id", "nombre")
  WHERE "deleted_at" IS NULL
`);

// En down() agregar:
await queryRunner.query(`DROP INDEX IF EXISTS "UQ_puntos_retiro_tenant_sede_nombre"`);
```

También verificar que la FK a `sedes` esté presente con `ON DELETE NO ACTION`.

### 4. Service — diferencias clave vs SedesService

**assertNombreUnico** incluye filtro por `sede_id`:
```typescript
private async assertNombreUnico(nombre: string, sedeId: string, excludeId?: string) {
  const tenantId = this.getTenantId({ strictTenant: true });
  const qb = this.puntoRetiroRepo.createQueryBuilder('p')
    .where('LOWER(p.nombre) = LOWER(:nombre)', { nombre })
    .andWhere('p.tenant_id = :tenantId', { tenantId })
    .andWhere('p.sede_id = :sedeId', { sedeId })
    .andWhere('p.deleted_at IS NULL');
  if (excludeId) qb.andWhere('p.id != :excludeId', { excludeId });
  const exists = await qb.getOne();
  if (exists) throw new AppError({ code: ErrorCodes.PUNTO_RETIRO_NOMBRE_DUPLICADO, status: 409, ... });
}
```

**create** valida sede antes de crear:
```typescript
async create(dto: CreatePuntoRetiroDto) {
  const sede = await this.sedesService.findOne(dto.sede_id); // lanza SEDE_NOT_FOUND si no existe
  if (!sede.activa) throw new AppError({ code: ErrorCodes.SEDE_INACTIVA, status: 409, ... });
  await this.assertNombreUnico(dto.nombre, dto.sede_id);
  return super.create(dto as Partial<PuntoRetiro>, { strictTenant: true });
}
```

**listPublic** filtra por `sedeId`:
```typescript
async listPublic(sedeId: string): Promise<PuntoRetiro[]> {
  const qb = this.puntoRetiroRepo.createQueryBuilder('p');
  this.applyTenantScopeQb(qb, 'p', { strictTenant: true });
  qb.andWhere('p.activo = true')
    .andWhere('p.sede_id = :sedeId', { sedeId })
    .orderBy('p.orden_visualizacion', 'ASC', 'NULLS LAST')
    .addOrderBy('p.nombre', 'ASC');
  return qb.getMany();
}
```

**list** incluye `sede_id` en filters:
```typescript
async list(query: QueryPuntoRetiroDto) {
  const filters: Record<string, any> = {};
  if (query.activo !== undefined) filters.activo = query.activo;
  if (query.sede_id !== undefined) filters.sede_id = query.sede_id;

  return super.list({ ...query, filters }, {
    searchColumns: ['nombre'],
    sortAllowed: ['nombre', 'orden_visualizacion', 'created_at'],
    sortFallback: { by: 'nombre', order: 'ASC' },
    filterAllowed: ['activo', 'sede_id'],
    strictTenant: true,
  });
}
```

### 5. Module — importar SedesModule

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([PuntoRetiro]),
    SedesModule,   // para inyectar SedesService
    AuditModule,
  ],
  providers: [PuntosRetiroService],
  controllers: [PuntosRetiroController, PublicPuntosRetiroController],
  exports: [PuntosRetiroService],
})
export class PuntosRetiroModule {}
```

### 6. Controller público — sede_id obligatorio

El DTO del endpoint público tiene `sede_id` requerido (sin `@IsOptional`):

```typescript
// En PublicPuntosRetiroController:
@Get()
async listPublic(@Query() query: PublicQueryPuntoRetiroDto) {
  const puntos = await this.svc.listPublic(query.sede_id);
  return ok(puntos);
}
```

O bien validarlo inline con un DTO dedicado que extienda solo lo necesario.

### 7. UpdatePuntoRetiroDto — sin sede_id

`UpdatePuntoRetiroDto` declara todos los campos del `CreatePuntoRetiroDto` como opcionales EXCEPTO `sede_id`. NO usar `PartialType(CreatePuntoRetiroDto)` (el paquete `@nestjs/mapped-types` no está instalado). Declarar campos explícitamente como se hizo en `sedes`.

## Constraints Recap

| Constraint | Cómo se aplica |
|-----------|----------------|
| No `repo.find()` sin tenant | Siempre via `super.*()` o `applyTenantScopeQb()` |
| No `throw new Error()` | Solo `AppError` con `ErrorCodes` |
| `sede_id` inmutable | Omitido del `UpdatePuntoRetiroDto` |
| Endpoint público NULLS LAST | `createQueryBuilder` propio en `listPublic()` |
| Respuestas via helpers | `ok()` y `page()` de `api-response.ts` |
| `migrationsRun: true` | Ya configurado — no tocar |
