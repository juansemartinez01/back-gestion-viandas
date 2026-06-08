# Quickstart: Entregas de Viandas

**Feature**: 017-entregas | **Date**: 2026-06-08

## Prerrequisitos

Completar en orden antes de implementar este módulo:
- Stage 5 completo: `produccion-viandas` y `stock-viandas` implementados y con migración aplicada
- Un `StockVianda` generado para el día (via confirmación de producción)
- Un `Pedido` en estado `confirmado_pago_online` o `confirmado_pago_presencial` con su `Pago` asociado

## Flujo de desarrollo

### 1. Agregar ErrorCodes

En `src/common/errors/error-codes.ts`, agregar bajo `// stock-viandas`:

```typescript
// entregas
ENTREGA_PEDIDO_NO_ENTREGABLE: 'ENTREGA_PEDIDO_NO_ENTREGABLE',
ENTREGA_YA_REGISTRADA: 'ENTREGA_YA_REGISTRADA',
ENTREGA_NOT_FOUND: 'ENTREGA_NOT_FOUND',
```

> **Nota**: No agregar `ENTREGA_STOCK_NO_DISPONIBLE` — el error `STOCK_INSUFICIENTE_ENTREGAS` (ya existe) es lanzado directamente por `StockViandasService.consumirParaEntrega`.

### 2. Crear la entidad

`src/modules/entregas/entities/entrega-pedido.entity.ts`

La entidad extiende `BaseEntity` (o su equivalente parcial con `id`, `tenant_id`, `created_at`) pero **sin** `updated_at` ni `deleted_at`.

Índices requeridos:
- `@Unique(['pedido_id'])` — garantiza 1 entrega por pedido
- `@Index(['tenant_id', 'fecha_entrega', 'sede_id'])` — cubre los filtros de listado

### 3. Crear los DTOs

**`crear-entrega.dto.ts`**: `pedido_id` (UUID, requerido), `punto_retiro_id` (UUID, requerido), `observacion` (string, opcional).

**`query-entregas.dto.ts`**: `fecha_desde`, `fecha_hasta` (ISO date), `sede_id`, `punto_retiro_id`, `usuario_id` (UUID), `page`, `limit` — todos opcionales.

**`buscar-por-dni.dto.ts`**: `dni` (string, requerido), `fecha` (ISO date, requerido), `sede_id` (UUID, requerido), `punto_retiro_id` (UUID, opcional).

### 4. Implementar el servicio

`src/modules/entregas/entregas.service.ts` — **NO** extiende `BaseCrudTenantService`.

#### registrarEntrega — patrón QueryRunner

```typescript
const tenantId = this.tenancyService.requireTenantId();
const qr = this.dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();

try {
  // 1. SELECT FOR UPDATE en el pedido
  const pedido = await qr.manager
    .getRepository(Pedido)
    .createQueryBuilder('p')
    .setLock('pessimistic_write')
    .where('p.id = :id AND p.tenant_id = :tenantId', { id: dto.pedido_id, tenantId })
    .getOne();

  if (!pedido) throw new AppError({ code: ErrorCodes.PEDIDO_NOT_FOUND, status: 404 });

  // 2. Validar estado
  const estadosElegibles = [EstadoPedido.CONFIRMADO_PAGO_ONLINE, EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL];
  if (!estadosElegibles.includes(pedido.estado_pedido)) {
    throw new AppError({ code: ErrorCodes.ENTREGA_PEDIDO_NO_ENTREGABLE, status: 409 });
  }

  // 3. Idempotencia
  const entregaExistente = await qr.manager.getRepository(EntregaPedido)
    .findOne({ where: { pedido_id: dto.pedido_id } });
  if (entregaExistente) {
    throw new AppError({ code: ErrorCodes.ENTREGA_YA_REGISTRADA, status: 409 });
  }

  // 4. Buscar StockVianda
  const stock = await this.stockRepo.findOne({
    where: {
      tenant_id: tenantId,
      fecha: pedido.fecha_retiro,
      sede_id: pedido.sede_id,
      punto_retiro_id: pedido.punto_retiro_id,
      menu_publicado_id: pedido.menu_publicado_id,
    },
  });
  if (!stock) throw new AppError({ code: ErrorCodes.STOCK_VIANDA_NOT_FOUND, status: 404 });

  // 5. Consumir stock (transacción interna propia)
  await this.stockViandasService.consumirParaEntrega(stock.id, pedido.cantidad, pedido.id, tenantId);

  // 6. Pago presencial inline via qr.manager
  let importeCobradoCaja = 0;
  if (pedido.medio_pago === MedioPagoPedido.PRESENCIAL) {
    const pago = await qr.manager.getRepository(Pago)
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId AND p.tenant_id = :tenantId', { pedidoId: pedido.id, tenantId })
      .getOne();
    if (!pago) throw new AppError({ code: ErrorCodes.PAGO_NOT_FOUND, status: 404 });
    if (pago.estado !== EstadoPago.PRESENCIAL_PENDIENTE) {
      throw new AppError({ code: ErrorCodes.PAGO_YA_COBRADO, status: 409 });
    }
    pago.estado = EstadoPago.PRESENCIAL_COBRADO;
    pago.fecha_registro_presencial = new Date();
    await qr.manager.getRepository(Pago).save(pago);
    importeCobradoCaja = Number(pedido.importe_total);
  }

  // 7–8. Actualizar pedido
  pedido.estado_pedido = EstadoPedido.ENTREGADO;
  pedido.fecha_confirmacion = new Date();
  await qr.manager.getRepository(Pedido).save(pedido);

  // 9. Crear EntregaPedido
  const entrega = qr.manager.getRepository(EntregaPedido).create({
    tenant_id: tenantId,
    pedido_id: pedido.id,
    sede_id: pedido.sede_id,
    punto_retiro_id: dto.punto_retiro_id,
    usuario_id: usuarioId,
    importe_cobrado_caja: importeCobradoCaja,
    fecha_entrega: new Date(),
    observacion: dto.observacion ?? null,
  });
  const savedEntrega = await qr.manager.getRepository(EntregaPedido).save(entrega);

  // 10. Auditoría
  await this.auditService.write('admin', {
    actor_user_id: usuarioId,
    action: 'entrega.registrada',
    entity: 'entrega_pedido',
    payload: auditLogPayload({ actorUserId: usuarioId, action: 'entrega.registrada', entity: 'entrega_pedido',
      extra: { entrega_id: savedEntrega.id, pedido_id: pedido.id, importe_cobrado_caja: importeCobradoCaja } }),
  });

  await qr.commitTransaction();

  // 11. Retornar con pedido
  savedEntrega.pedido = pedido;
  return savedEntrega;

} catch (err) {
  await qr.rollbackTransaction();
  throw err;
} finally {
  await qr.release();
}
```

#### buscarPorDni

```typescript
const tenantId = this.tenancyService.requireTenantId();
const qb = this.pedidoRepo
  .createQueryBuilder('p')
  .leftJoinAndSelect('p.menuPublicado', 'mp')
  .leftJoinAndSelect('mp.menuBase', 'mb')
  .where('p.tenant_id = :tenantId', { tenantId })
  .andWhere('p.dni_informado ILIKE :dni', { dni: query.dni })
  .andWhere('p.estado_pedido IN (:...estados)', {
    estados: [EstadoPedido.CONFIRMADO_PAGO_ONLINE, EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL],
  })
  .andWhere('p.fecha_retiro = :fecha', { fecha: query.fecha })
  .andWhere('p.sede_id = :sedeId', { sedeId: query.sede_id })
  .andWhere('p.deleted_at IS NULL');

if (query.punto_retiro_id) {
  qb.andWhere('p.punto_retiro_id = :puntoRetiroId', { puntoRetiroId: query.punto_retiro_id });
}

return qb.orderBy('p.apellido_informado', 'ASC').getMany();
```

### 5. Implementar el controller

**Orden de declaración de handlers** (crítico):

```typescript
@Post('/')             // registrarEntrega
@Get('/')              // list
@Get('buscar-por-dni') // ← ANTES de /:id
@Get(':id')            // findOne
```

Extraer `usuarioId` del JWT: `@Req() req: Request` → `req.user['sub']` (o el campo equivalente del token según el template).

### 6. Crear el módulo

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([EntregaPedido, Pedido, StockVianda, Pago]),
    PedidosModule,
    PagosModule,
    StockViandasModule,
    AuditModule,
    TenancyModule,
  ],
  providers: [EntregasService],
  controllers: [EntregasController],
  exports: [EntregasService],
})
export class EntregasModule {}
```

> **Nota**: `Pago` se agrega al `forFeature` para que `qr.manager.getRepository(Pago)` funcione correctamente durante la transacción.

### 7. Registrar en AppModule

```typescript
import { EntregasModule } from './modules/entregas/entregas.module';
// ... en imports: [..., EntregasModule]
```

### 8. Generar y revisar la migración

```bash
npm run db:migration:generate -- migrations/CreateEntregas
```

Verificar en el archivo generado:
- Tabla `entrega_pedidos` con todos los campos
- Constraint `UNIQUE` en `pedido_id`
- Índice compuesto `(tenant_id, fecha_entrega, sede_id)`
- **Sin** columna `deleted_at`
- **Sin** columna `updated_at`

### 9. Aplicar la migración

```bash
npm run db:migration:run
```

## Verificación rápida

```bash
# 1. Compilar sin errores
npm run build

# 2. Levantar servidor
npm run start:dev

# 3. Buscar pedido por DNI (requiere pedido confirmado en DB)
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/admin/entregas/buscar-por-dni?dni=12345678&fecha=2026-06-08&sede_id=<uuid>"

# 4. Registrar entrega
curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"pedido_id":"<uuid>","punto_retiro_id":"<uuid>"}' \
     http://localhost:3000/admin/entregas

# 5. Verificar que el pedido queda en estado "entregado"
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/admin/pedidos/<pedido_id>"

# 6. Verificar que el stock fue decrementado
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/admin/stock-viandas/<stock_id>"

# 7. Intentar entregar el mismo pedido de nuevo → debe retornar ENTREGA_YA_REGISTRADA (409)
```

## Caveats conocidos

- **Pago en Pago module**: `PagosService.registrarCobroPresencial` no acepta QueryRunner. Por eso el cobro se realiza inline via `qr.manager`. No llamar a `PagosService.registrarCobroPresencial` desde dentro de la transacción.
- **Stock en transacción separada**: `StockViandasService.consumirParaEntrega` abre su propia transacción interna. Ver `research.md` Decision 3 para el análisis completo del trade-off.
- **Pago entity en forFeature**: Agregar `Pago` explícitamente al `TypeOrmModule.forFeature` del módulo para que el `qr.manager.getRepository(Pago)` tenga el tipo mapeado correctamente.
