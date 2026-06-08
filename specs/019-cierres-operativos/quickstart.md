# Quickstart: Cierres Operativos

## Prerequisites

- Módulos `entregas` y `ventas-sobrantes` implementados y funcionando.
- Error codes `CIERRE_OPERATIVO_NOT_FOUND`, `CIERRE_YA_EXISTE`, `CIERRE_DIA_CERRADO` agregados a `src/common/errors/error-codes.ts`.

## Common Operations

### 1. Previsualizar resumen antes de cerrar

```http
GET /admin/cierres-operativos/resumen-previo?fecha=2026-06-08&sede_id=<uuid>&punto_retiro_id=<uuid>
Authorization: Bearer <token>
```

### 2. Ejecutar cierre del día

```http
POST /admin/cierres-operativos
Authorization: Bearer <token>
Content-Type: application/json

{
  "fecha_operativa": "2026-06-08",
  "sede_id": "<uuid>",
  "punto_retiro_id": "<uuid>",
  "observacion": "Cierre normal sin novedades"
}
```

### 3. Consultar historial de cierres

```http
GET /admin/cierres-operativos?fecha_desde=2026-06-01&fecha_hasta=2026-06-08&sede_id=<uuid>
Authorization: Bearer <token>
```

### 4. Ver detalle de un cierre

```http
GET /admin/cierres-operativos/<id>
Authorization: Bearer <token>
```

## Integration: Blocking Operations on Closed Days

From `EntregasService` or `VentasSobrantesService`, inject `CierresOperativosService` and call:

```typescript
const cerrado = await this.cierresService.isDiaCerrado(
  fechaOperativa,
  sedeId,
  puntoRetiroId,
  tenantId,
);
if (cerrado) {
  throw new AppError({
    code: ErrorCodes.CIERRE_DIA_CERRADO,
    message: 'El día operativo ya fue cerrado para este punto de retiro',
    status: 409,
  });
}
```

## Database Migration

```bash
npm run db:migration:generate -- migrations/CreateCierresOperativos
npm run db:migration:run
```

Verify the generated migration includes:
- `CREATE TABLE cierres_operativos` with all columns
- `UNIQUE(tenant_id, fecha_operativa, sede_id, punto_retiro_id)` constraint
- `CREATE INDEX idx_cierre_tenant_fecha_sede ON cierres_operativos(tenant_id, fecha_operativa, sede_id)`
- No `updated_at` or `deleted_at` columns

## Module Registration

Add to `AppModule` imports:

```typescript
import { CierresOperativosModule } from './modules/cierres-operativos/cierres-operativos.module';
// ...
@Module({
  imports: [
    // ...existing modules...
    CierresOperativosModule,
  ],
})
export class AppModule {}
```

## Circular Dependency Note

`CierresOperativosModule` exports `CierresOperativosService`.
`EntregasModule` and `VentasSobrantesModule` import `CierresOperativosModule`.
`CierresOperativosModule` does NOT import `EntregasModule` or `VentasSobrantesModule` as services — it only uses their repositories directly via `TypeOrmModule.forFeature`. This avoids circular imports.
