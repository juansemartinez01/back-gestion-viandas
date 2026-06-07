# Data Model: Módulo Menús Base

## Entidad: MenuBase

**Tabla**: `menus_base`

| Campo | Tipo | Nullable | Default | Notas |
|-------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK, heredado de BaseEntity |
| tenant_id | uuid | NO | — | FK, heredado de BaseEntity |
| nombre | varchar(200) | NO | — | Único por tenant (índice parcial) |
| descripcion | text | YES | NULL | — |
| imagen_public_id | varchar(500) | YES | NULL | assetId del servicio de archivos |
| imagen_url | varchar(1000) | YES | NULL | URL pública del archivo |
| ingredientes_principales | text | YES | NULL | Texto libre informativo |
| calorias_aprox | decimal(6,2) | YES | NULL | — |
| proteinas_aprox | decimal(6,2) | YES | NULL | — |
| carbohidratos_aprox | decimal(6,2) | YES | NULL | — |
| grasas_aprox | decimal(6,2) | YES | NULL | — |
| activo | boolean | NO | true | — |
| created_at | timestamptz | NO | now() | Heredado de BaseEntity |
| updated_at | timestamptz | NO | now() | Heredado de BaseEntity |
| deleted_at | timestamptz | YES | NULL | Soft delete (heredado) |

**Índices**:
```sql
CREATE UNIQUE INDEX "UQ_menus_base_tenant_nombre"
ON "menus_base" ("tenant_id", "nombre")
WHERE "deleted_at" IS NULL;
```

### Decoradores TypeORM

```typescript
@Entity('menus_base')
@Index('UQ_menus_base_tenant_nombre', ['tenant_id', 'nombre'], { unique: true })
export class MenuBase extends BaseEntity {
  @Column({ type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_public_id!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imagen_url!: string | null;

  @Column({ type: 'text', nullable: true })
  ingredientes_principales!: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  calorias_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  proteinas_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  carbohidratos_aprox!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  grasas_aprox!: number | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @ManyToMany(() => CategoriaMenu)
  @JoinTable({
    name: 'menu_base_categorias',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'categoria_menu_id' },
  })
  categorias!: CategoriaMenu[];

  @ManyToMany(() => EtiquetaMenu)
  @JoinTable({
    name: 'menu_base_etiquetas',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'etiqueta_menu_id' },
  })
  etiquetas!: EtiquetaMenu[];

  @ManyToMany(() => Alergeno)
  @JoinTable({
    name: 'menu_base_alergenos',
    joinColumn: { name: 'menu_base_id' },
    inverseJoinColumn: { name: 'alergeno_id' },
  })
  alergenos!: Alergeno[];
}
```

---

## Tablas intermedias M2M

### menu_base_categorias

| Campo | Tipo | FK |
|-------|------|----|
| menu_base_id | uuid | menus_base(id) CASCADE |
| categoria_menu_id | uuid | categorias_menu(id) CASCADE |

### menu_base_etiquetas

| Campo | Tipo | FK |
|-------|------|----|
| menu_base_id | uuid | menus_base(id) CASCADE |
| etiqueta_menu_id | uuid | etiquetas_menu(id) CASCADE |

### menu_base_alergenos

| Campo | Tipo | FK |
|-------|------|----|
| menu_base_id | uuid | menus_base(id) CASCADE |
| alergeno_id | uuid | alergenos(id) CASCADE |

---

## DTOs

### CreateMenuBaseDto

```typescript
export class CreateMenuBaseDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  nombre!: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsOptional() @IsString() @MaxLength(500)
  imagen_public_id?: string;

  @IsOptional() @IsUrl() @MaxLength(1000)
  imagen_url?: string;

  @IsOptional() @IsString()
  ingredientes_principales?: string;

  @IsOptional() @IsNumber() @Min(0)
  calorias_aprox?: number;

  @IsOptional() @IsNumber() @Min(0)
  proteinas_aprox?: number;

  @IsOptional() @IsNumber() @Min(0)
  carbohidratos_aprox?: number;

  @IsOptional() @IsNumber() @Min(0)
  grasas_aprox?: number;

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  categoria_ids?: string[];

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  etiqueta_ids?: string[];

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  alergeno_ids?: string[];
}
```

### UpdateMenuBaseDto

Todos los campos de Create declarados explícitamente con `@IsOptional()`. NO usar `PartialType`.

```typescript
export class UpdateMenuBaseDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  nombre?: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsOptional() @IsString() @MaxLength(500)
  imagen_public_id?: string;

  @IsOptional() @IsUrl() @MaxLength(1000)
  imagen_url?: string;

  @IsOptional() @IsString()
  ingredientes_principales?: string;

  @IsOptional() @IsNumber() @Min(0)
  calorias_aprox?: number;

  @IsOptional() @IsNumber() @Min(0)
  proteinas_aprox?: number;

  @IsOptional() @IsNumber() @Min(0)
  carbohidratos_aprox?: number;

  @IsOptional() @IsNumber() @Min(0)
  grasas_aprox?: number;

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  categoria_ids?: string[];

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  etiqueta_ids?: string[];

  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  alergeno_ids?: string[];
}
```

### QueryMenuBaseDto

```typescript
export class QueryMenuBaseDto extends PageQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  activo?: boolean;

  @IsOptional() @IsUUID('4')
  categoria_id?: string;

  @IsOptional() @IsUUID('4')
  etiqueta_id?: string;

  @IsOptional() @IsUUID('4')
  alergeno_id?: string;

  @IsOptional() @IsIn(['nombre', 'created_at'])
  sortBy?: string;

  @IsOptional() @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
```

---

## Error Codes

Agregar a `src/common/errors/error-codes.ts`:

```typescript
// menus-base
MENU_BASE_NOT_FOUND: 'MENU_BASE_NOT_FOUND',
MENU_BASE_NOMBRE_DUPLICADO: 'MENU_BASE_NOMBRE_DUPLICADO',
MENU_BASE_YA_ACTIVO: 'MENU_BASE_YA_ACTIVO',
MENU_BASE_YA_INACTIVO: 'MENU_BASE_YA_INACTIVO',
MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR: 'MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR',
MENU_BASE_RELACION_INVALIDA: 'MENU_BASE_RELACION_INVALIDA',
```

HTTP status mapping (en AppError o equivalente):
- `MENU_BASE_NOT_FOUND` → 404
- `MENU_BASE_NOMBRE_DUPLICADO` → 409
- `MENU_BASE_YA_ACTIVO` → 409
- `MENU_BASE_YA_INACTIVO` → 409
- `MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` → 409
- `MENU_BASE_RELACION_INVALIDA` → 422

---

## Diagrama de estado: MenuBase.activo

```
          crear
            │
            ▼
         [activo=true]
          /       \
    inactivar     (ya activo → MENU_BASE_YA_ACTIVO)
          │
          ▼
      [activo=false]
       /        \
  activar      remove()
      │             │
      ▼             ▼
  [activo=true]  [deleted_at=now()]
```

Reglas de transición:
- `activo=true` → inactivar → `activo=false` ✅
- `activo=false` → activar → `activo=true` ✅
- `activo=true` → activar → error `MENU_BASE_YA_ACTIVO` ❌
- `activo=false` → inactivar → error `MENU_BASE_YA_INACTIVO` ❌
- `activo=true` → remove → error `MENU_BASE_DEBE_INACTIVARSE_ANTES_DE_ELIMINAR` ❌
- `activo=false` → remove → soft delete ✅

---

## Módulo: MenusBaseModule

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([MenuBase, CategoriaMenu, EtiquetaMenu, Alergeno]),
    AuditModule,
  ],
  providers: [MenusBaseService],
  controllers: [MenusBaseController, PublicMenusBaseController],
  exports: [MenusBaseService],
})
export class MenusBaseModule {}
```

Registrar en `src/app.module.ts`:
```typescript
imports: [
  // ... módulos existentes ...
  MenusBaseModule,
]
```
