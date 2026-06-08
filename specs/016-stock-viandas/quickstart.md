# Quickstart: Stock Operativo de Viandas

**Branch**: `016-stock-viandas` | **Date**: 2026-06-08

## Pasos de implementación resumidos

### 1. Agregar códigos de error

En `src/common/errors/error-codes.ts`, agregar al final de la sección `// produccion-viandas`:

```typescript
// stock-viandas
STOCK_VIANDA_NOT_FOUND: 'STOCK_VIANDA_NOT_FOUND',
STOCK_INSUFICIENTE_ENTREGAS: 'STOCK_INSUFICIENTE_ENTREGAS',
STOCK_INSUFICIENTE_SOBRANTES: 'STOCK_INSUFICIENTE_SOBRANTES',
STOCK_AJUSTE_INVALIDO: 'STOCK_AJUSTE_INVALIDO',
```

### 2. Crear archivos del módulo

Crear en `src/modules/stock-viandas/`:

```
stock-vianda.enums.ts
entities/stock-vianda.entity.ts
entities/movimiento-stock-vianda.entity.ts
dto/ajustar-stock.dto.ts
dto/query-stock.dto.ts
stock-viandas.service.ts
stock-viandas.controller.ts
stock-viandas.module.ts
```

Ver `data-model.md` para la definición exacta de entidades.
Ver `contracts/api-endpoints.md` para la lógica de servicio y controlador.

### 3. Generar migración

```bash
npm run db:migration:generate -- migrations/CreateStockViandas
```

Verificar que la migración incluye:
- Tabla `stock_viandas` con constraint `UNIQUE (tenant_id, fecha, sede_id, punto_retiro_id, menu_publicado_id)`
- Tabla `movimientos_stock_viandas`
- Índices descritos en `data-model.md`

### 4. Activar TODO en ProduccionViandasModule

En `src/modules/produccion-viandas/produccion-viandas.module.ts`, descomentar el bloque de `forwardRef(() => StockViandasModule)`.

En `src/modules/produccion-viandas/produccion-viandas.service.ts`, descomentar el inject de `StockViandasService` y la llamada en `confirmarProduccion()`.

### 5. Registrar en AppModule

En `src/app.module.ts`, agregar `StockViandasModule` a la lista de imports.

### 6. Ejecutar migración

```bash
npm run db:migration:run
```

### 7. Verificar

```bash
npm run build
npm run start:dev
```

Testear con Postman:
- `GET /admin/stock-viandas` — debe retornar lista vacía inicialmente
- Confirmar una producción existente → debe generar StockVianda automáticamente
- `GET /admin/stock-viandas` → debe aparecer el stock generado
- `POST /admin/stock-viandas/:id/ajustar` → debe ajustar y auditar

## Patrones clave a seguir

- Ver `produccion-viandas.service.ts` para el patrón de `BaseCrudTenantService` y uso de `mustFindById`.
- Ver `produccion-viandas.module.ts` para el patrón de imports con `AuditModule` y `TenancyModule`.
- Ver `src/common/http/api-response.ts` para los helpers `ok()` y `page()`.
- **No usar `throw new Error()`** — siempre `throw new AppError({ code: ErrorCodes.X, message: '...', status: N })`.

## Notas de concurrencia

`consumirParaEntrega` y `consumirParaSobrante` deben usar:

```typescript
await this.dataSource.transaction(async (em) => {
  const stock = await em
    .getRepository(StockVianda)
    .createQueryBuilder('sv')
    .setLock('pessimistic_write')  // SELECT FOR UPDATE
    .where('sv.id = :id', { id: stockViandaId })
    .andWhere('sv.tenant_id = :tenantId', { tenantId })
    .getOne();
  // ... validar y actualizar
});
```
