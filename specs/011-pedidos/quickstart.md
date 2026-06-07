# Quickstart: Módulo Pedidos

**Feature**: 011-pedidos | **Date**: 2026-06-07

## Flujo de implementación sugerido

1. Agregar error codes en `src/common/errors/error-codes.ts`
2. Crear `pedido.enums.ts`
3. Crear `pedido.entity.ts`
4. Crear DTOs
5. Crear `PedidosService`
6. Crear `PublicPedidosController` y `PedidosController`
7. Crear `PedidosExpiracionJob`
8. Crear `PedidosModule` y registrar en `AppModule`
9. Generar y verificar migración

## Dependencias del módulo

```
PedidosModule
  ├── imports:
  │   ├── TypeOrmModule.forFeature([Pedido])
  │   ├── ClientesModule           ← upsertByDni
  │   ├── MenusPublicadosModule    ← findOne, validar estado ACTIVO
  │   ├── SedesModule              ← (por FK, no métodos directos)
  │   ├── PuntosRetiroModule       ← (por FK, no métodos directos)
  │   └── AuditModule              ← AuditService.write()
  ├── providers: [PedidosService, PedidosExpiracionJob]
  ├── controllers: [PedidosController, PublicPedidosController]
  └── exports: [PedidosService]
```

## Nota sobre ScheduleModule

`ScheduleModule.forRoot()` ya está registrado en `AuditModule` (global). **No** agregar `ScheduleModule` ni en `PedidosModule` ni en `AppModule`.

## Patrón transaccional para `crearPedido`

```typescript
const qr = this.dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
try {
  // 1. Validar menú y punto de retiro (con qr.manager si necesita consistencia)
  // 2. Contar pedidos existentes con FOR UPDATE (si hay limite_maximo_viandas)
  // 3. Upsert cliente (puede ser fuera de transacción — idempotente)
  // 4. generarCodigoPublico(tenantId, year, qr)  ← también usa FOR UPDATE
  // 5. qr.manager.save(Pedido, pedidoData)
  await qr.commitTransaction();
  return pedido;
} catch (err) {
  await qr.rollbackTransaction();
  throw err;
} finally {
  await qr.release();
}
```

## Generación de `codigo_publico`

```
Formato: VIA-{AÑO}-{NNNNNN}  (6 dígitos con leading zeros)
Ejemplo: VIA-2026-000001

Algoritmo:
1. SELECT MAX(codigo_publico) FROM pedidos
   WHERE tenant_id = :tenantId
   AND codigo_publico LIKE 'VIA-2026-%'
   FOR UPDATE
2. Si null → secuencia = 1
3. Si no null → extraer número del substring después de 'VIA-2026-', parseInt, +1
4. Formatear: `VIA-${year}-${String(seq).padStart(6, '0')}`
```

## Validación de capacidad (`limite_maximo_viandas`)

```typescript
if (menuPublicado.limite_maximo_viandas !== null) {
  const count = await qr.manager
    .createQueryBuilder(Pedido, 'p')
    .where('p.tenant_id = :tenantId', { tenantId })
    .andWhere('p.menu_publicado_id = :mpId', { mpId: menuPublicado.id })
    .andWhere('p.fecha_retiro = :fecha', { fecha: menuPublicado.fecha_venta })
    .andWhere('p.estado_pedido IN (:...estados)', {
      estados: [
        EstadoPedido.CONFIRMADO_PAGO_PRESENCIAL,
        EstadoPedido.CONFIRMADO_PAGO_ONLINE,
        EstadoPedido.PENDIENTE_PAGO_ONLINE,
      ],
    })
    .andWhere('p.deleted_at IS NULL')
    .setLock('pessimistic_write')
    .select('SUM(p.cantidad)', 'total')
    .getRawOne();

  const totalActual = parseInt(count?.total ?? '0', 10);
  if (totalActual + dto.cantidad > menuPublicado.limite_maximo_viandas) {
    throw new AppError({ code: ErrorCodes.PEDIDO_CAPACIDAD_AGOTADA, ... });
  }
}
```

## Job de expiración (`PedidosExpiracionJob`)

```typescript
@Injectable()
export class PedidosExpiracionJob {
  constructor(
    @InjectRepository(Pedido) private readonly repo: Repository<Pedido>,
  ) {}

  @Cron('*/5 * * * *')  // cada 5 minutos
  async expirarReservas() {
    const pedidosExpirados = await this.repo
      .createQueryBuilder('p')
      .where('p.estado_pedido = :estado', { estado: EstadoPedido.PENDIENTE_PAGO_ONLINE })
      .andWhere('p.expires_at < NOW()')
      .andWhere('p.deleted_at IS NULL')
      .getMany();

    for (const pedido of pedidosExpirados) {
      pedido.estado_pedido = EstadoPedido.CANCELADO;
      pedido.estado_pago = EstadoPagoPedido.CANCELADO;
      pedido.cancelado_por = OrigenCancelacion.ADMINISTRACION;
      pedido.motivo_cancelacion = 'Reserva expirada automáticamente';
      pedido.fecha_cancelacion = new Date();
    }

    if (pedidosExpirados.length > 0) {
      await this.repo.save(pedidosExpirados);
    }
  }
}
```

## Migración

```bash
npm run db:migration:generate -- migrations/CreatePedidos
```

Verificar en la migración generada:
- Enums PostgreSQL: `estado_pedido_enum`, `estado_pago_pedido_enum`, `medio_pago_pedido_enum`, `origen_cancelacion_enum`
- Índices compuestos: `idx_pedidos_tenant_dni`, `idx_pedidos_tenant_mp_estado`, `idx_pedidos_tenant_expires`
- Unique constraint en `codigo_publico`
- Columnas `nullable: true` correctas para campos opcionales

## Rutas públicas — no requieren JWT

Las siguientes rutas deben estar excluidas de `JwtAuthGuard`:
- `POST /public/pedidos`
- `GET /public/pedidos/consultar`
- `POST /public/pedidos/:id/cancelar`

El middleware de tenancy sigue aplicando — necesita header `x-tenant-key`.
