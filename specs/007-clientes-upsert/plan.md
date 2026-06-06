# Implementation Plan: Módulo Clientes

**Branch**: `007-clientes-upsert` | **Date**: 2026-06-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-clientes-upsert/spec.md`

## Summary

Implementar el módulo `clientes` (Stage 1, sexto y último módulo de Master Data) para el sistema Rochester de gestión de viandas. Un cliente es la persona identificada por DNI que realiza encargos. El módulo es Type A con un método interno especial (`upsertByDni`) que es el único punto de creación/actualización de clientes. No tiene endpoint público ni portal. La interacción del back office se limita a consulta y bloqueo/desbloqueo. `ClientesService` debe exportarse para uso por `PedidosModule` en Stage 3.

## Technical Context

**Language/Version**: TypeScript 5.x (NestJS 10.x)

**Primary Dependencies**: NestJS, TypeORM, class-validator, class-transformer, nestjs-pino

**Storage**: PostgreSQL 15+ via TypeORM (`DataSource`, `Repository`, `QueryBuilder`)

**Target Platform**: Railway (prod) / localhost (dev)

**Project Type**: REST API — módulo de gestión de clientes tenant-safe dentro del Innoview Backend Template

**Performance Goals**: Listados < 2 segundos con hasta 5000 clientes por tenant; `upsertByDni` < 200ms p95 (llamado en cada pedido)

**Constraints**:
- Sin `synchronize: true`. Sin `throw new Error()`. Sin `repo.find()` sin scope de tenant.
- `upsertByDni` es el único punto de creación — no exponer `POST /admin/clientes`.
- Búsqueda en `list()` aplica ILIKE sobre dni, nombre Y apellido (OR entre los tres).
- Exportar `ClientesService` obligatoriamente.
- No hay soft delete operativo (clientes se bloquean, no se eliminan).
- No hay endpoint público (no `PublicClientesController`).

**Scale/Scope**: Múltiples tenants; volumen estimado: cientos a pocos miles de clientes por tenant en MVP.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Template API Contract | ✅ | Usa `ok()`, `page()`, `AppError`, `ErrorCodes` |
| II. Multi-Tenancy by Default | ✅ | QB propio con `tenant_id` explícito en `list()` y `upsertByDni()`; `findById()` con `strictTenant: true` |
| III. RBAC | ✅ | `JwtAuthGuard + RolesGuard` a nivel clase; bloquear/desbloquear solo `administrador`; listado/detalle `administrador` + `supervisor` |
| IV. Business Rule Integrity | ✅ | `fecha_primera_operacion` inmutable; no sobrescritura de campos opcionales con vacío; validación de estado doble en bloquear/desbloquear |
| V. Audit Trail | ✅ | `AuditService.write()` en `bloquear` y `desbloquear` |
| VI. Module Architecture | ✅ | Type A — extends `BaseCrudTenantService`; estructura entity/dto/service/controller/module; sin public controller |
| VII. Implementation Discipline | ✅ | Stage 1, sexto módulo: sedes → puntos-retiro → categorias-menu → etiquetas-menu → alergenos → **clientes** |

**Resultado**: 7/7 ✅ — sin violaciones. Sin `Complexity Tracking` necesario.

## Project Structure

### Documentation (this feature)

```text
specs/007-clientes-upsert/
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas (upsert, búsqueda OR, índice parcial)
├── data-model.md        # Entidad, DTOs, estados, error codes
├── quickstart.md        # Smoke tests + checklist post-implementación
├── contracts/
│   └── api-endpoints.md # 4 endpoints HTTP + contrato upsertByDni interno
└── tasks.md             # Generado por /speckit-tasks
```

### Source Code

```text
src/
├── common/
│   └── errors/
│       └── error-codes.ts              # +4 nuevos códigos CLIENTE_*
├── modules/
│   └── clientes/
│       ├── entities/
│       │   └── cliente.entity.ts
│       ├── dto/
│       │   ├── query-cliente.dto.ts
│       │   └── upsert-cliente.dto.ts
│       ├── clientes.service.ts
│       ├── clientes.controller.ts      # Solo admin (sin public controller)
│       └── clientes.module.ts
└── app.module.ts                        # Registrar ClientesModule

migrations/
└── <timestamp>-CreateClientes.ts        # Generar + editar índice parcial
```

## Implementation Notes

### 1. ErrorCodes — agregar primero

```typescript
// src/common/errors/error-codes.ts — agregar sección // clientes:
CLIENTE_NOT_FOUND: 'CLIENTE_NOT_FOUND',           // 404
CLIENTE_DNI_DUPLICADO: 'CLIENTE_DNI_DUPLICADO',   // 409 (defensa; raramente alcanzable)
CLIENTE_YA_BLOQUEADO: 'CLIENTE_YA_BLOQUEADO',     // 409
CLIENTE_YA_ACTIVO: 'CLIENTE_YA_ACTIVO',           // 409
```

### 2. Entidad

```typescript
@Entity('clientes')
@Index('UQ_clientes_tenant_dni', ['tenant_id', 'dni'], { unique: true })
export class Cliente extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  dni!: string;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'varchar', length: 100 })
  apellido!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ type: 'date' })
  fecha_primera_operacion!: Date;

  @Column({ type: 'date' })
  fecha_ultima_operacion!: Date;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;
}
```

> **Nota**: El `@Index` genera índice completo; la migración debe reemplazarlo por el índice parcial `WHERE deleted_at IS NULL`.

### 3. Migración — edición manual obligatoria

Después de `npm run db:migration:generate -- migrations/CreateClientes`, editar el archivo generado:

```typescript
// Reemplazar el índice único auto-generado por:
await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_clientes_tenant_dni"
  ON "clientes" ("tenant_id", "dni")
  WHERE "deleted_at" IS NULL
`);

// En down() usar:
await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_clientes_tenant_dni"`);
```

### 4. Service

```typescript
@Injectable()
export class ClientesService extends BaseCrudTenantService<Cliente> {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {
    super(clienteRepo);
  }

  async list(query: QueryClienteDto) {
    const tenantId = this.getTenantId({ strictTenant: true });
    const qb = this.clienteRepo.createQueryBuilder('cl')
      .where('cl.tenant_id = :tenantId', { tenantId })
      .andWhere('cl.deleted_at IS NULL');

    if (query.q) {
      qb.andWhere(
        '(cl.dni ILIKE :q OR cl.nombre ILIKE :q OR cl.apellido ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    if (query.activo !== undefined) {
      qb.andWhere('cl.activo = :activo', { activo: query.activo });
    }

    const sortBy = ['apellido', 'nombre', 'fecha_ultima_operacion', 'created_at'].includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'apellido';
    qb.orderBy(`cl.${sortBy}`, query.sortOrder ?? 'ASC');

    const limit = query.limit ?? 20;
    const currentPage = query.page ?? 1;
    qb.skip((currentPage - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<Cliente> {
    const cl = await this.findById(id, { strictTenant: true });
    if (!cl) {
      throw new AppError({
        code: ErrorCodes.CLIENTE_NOT_FOUND,
        message: 'Cliente no encontrado',
        status: 404,
        details: { id },
      });
    }
    return cl;
  }

  async upsertByDni(dto: UpsertClienteDto): Promise<Cliente> {
    const tenantId = this.getTenantId({ strictTenant: true });
    const today = new Date();

    const existing = await this.clienteRepo
      .createQueryBuilder('cl')
      .where('cl.tenant_id = :tenantId', { tenantId })
      .andWhere('cl.dni = :dni', { dni: dto.dni })
      .andWhere('cl.deleted_at IS NULL')
      .getOne();

    if (existing) {
      existing.nombre = dto.nombre;
      existing.apellido = dto.apellido;
      if (dto.telefono !== undefined && dto.telefono !== '') existing.telefono = dto.telefono;
      if (dto.email !== undefined && dto.email !== '') existing.email = dto.email;
      existing.fecha_ultima_operacion = today;
      return this.clienteRepo.save(existing);
    }

    const nuevo = this.clienteRepo.create({
      tenant_id: tenantId,
      dni: dto.dni,
      nombre: dto.nombre,
      apellido: dto.apellido,
      telefono: dto.telefono ?? null,
      email: dto.email ?? null,
      fecha_primera_operacion: today,
      fecha_ultima_operacion: today,
      activo: true,
    });
    return this.clienteRepo.save(nuevo);
  }

  async bloquear(id: string): Promise<Cliente> {
    const cl = await this.findOne(id);
    if (!cl.activo) {
      throw new AppError({
        code: ErrorCodes.CLIENTE_YA_BLOQUEADO,
        message: 'El cliente ya se encuentra bloqueado',
        status: 409,
        details: { id },
      });
    }
    cl.activo = false;
    return this.clienteRepo.save(cl);
  }

  async desbloquear(id: string): Promise<Cliente> {
    const cl = await this.findOne(id);
    if (cl.activo) {
      throw new AppError({
        code: ErrorCodes.CLIENTE_YA_ACTIVO,
        message: 'El cliente ya se encuentra activo',
        status: 409,
        details: { id },
      });
    }
    cl.activo = true;
    return this.clienteRepo.save(cl);
  }
}
```

### 5. Controller

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/clientes')
export class ClientesController {
  constructor(
    private readonly svc: ClientesService,
    private readonly logger: PinoLogger,
    private readonly audit: AuditService,
  ) {}

  @Roles('administrador', 'supervisor')
  @Get()
  async list(@Query() query: QueryClienteDto) {
    const { items, total } = await this.svc.list(query);
    return page(items, query.page ?? 1, query.limit ?? 20, total);
  }

  @Roles('administrador', 'supervisor')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return ok(await this.svc.findOne(id));
  }

  @Roles('administrador')
  @Patch(':id/bloquear')
  async bloquear(@Req() req: any, @Param('id') id: string) {
    const cl = await this.svc.bloquear(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'cliente.bloqueado',
      entity: 'cliente',
      extra: { clienteId: id, dni: cl.dni, nombre: cl.nombre, apellido: cl.apellido },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'cliente.bloqueado',
      entity: 'cliente',
      payload: auditData,
    });

    return ok(cl);
  }

  @Roles('administrador')
  @Patch(':id/desbloquear')
  async desbloquear(@Req() req: any, @Param('id') id: string) {
    const cl = await this.svc.desbloquear(id);

    const auditData = auditLogPayload({
      requestId: req.id,
      actorUserId: req.user?.sub,
      actorEmail: req.user?.email,
      action: 'cliente.desbloqueado',
      entity: 'cliente',
      extra: { clienteId: id, dni: cl.dni, nombre: cl.nombre, apellido: cl.apellido },
    });
    this.logger.info(auditData, 'admin_audit');
    await this.audit.write('admin', {
      request_id: req.id,
      method: req.method,
      path: req.url,
      status_code: 200,
      actor_user_id: req.user?.sub ?? null,
      actor_email: req.user?.email ?? null,
      action: 'cliente.desbloqueado',
      entity: 'cliente',
      payload: auditData,
    });

    return ok(cl);
  }
}
```

### 6. Module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Cliente]), AuditModule],
  providers: [ClientesService],
  controllers: [ClientesController],
  exports: [ClientesService],
})
export class ClientesModule {}
```

> **Sin** `PublicClientesController`.
> `ClientesService` exportado — requerido por `PedidosModule` en Stage 3.

### 7. AppModule

```typescript
// En la lista de imports de AppModule:
ClientesModule,
```

## Constraints Recap

| Constraint | Cómo se aplica |
|-----------|----------------|
| No `repo.find()` sin tenant | `list()` usa QB propio con `WHERE cl.tenant_id = :tenantId`; `findOne()` via `findById()` con `strictTenant: true`; `upsertByDni()` via QB con `tenant_id` explícito |
| No `throw new Error()` | Solo `AppError` con `ErrorCodes` |
| Búsqueda OR en 3 campos | QB con `(cl.dni ILIKE :q OR cl.nombre ILIKE :q OR cl.apellido ILIKE :q)` |
| `upsertByDni` único punto de creación | No hay `POST /admin/clientes`; no hay método `create()` en el service |
| `fecha_primera_operacion` inmutable | Solo asignada en la rama de creación de `upsertByDni`; no tocada en rama de update |
| Exportar `ClientesService` | `exports: [ClientesService]` en `ClientesModule` |
| Alias QB `'cl'` | Consistente con convención de módulos del template |
| Sin public controller | Solo `ClientesController` (back office) |
| Índice parcial en migración | Edición manual post-generación; mismo patrón que alergenos |
