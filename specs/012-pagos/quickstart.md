# Quickstart: Pagos

**Feature**: 012-pagos | **Date**: 2026-06-07

## Integration Pattern: Crear Pedido con Pago

El patrón clave es que `PagosService` recibe el `QueryRunner` activo de `PedidosService` para persistir el pago dentro de la misma transacción atómica.

```typescript
// En PedidosService._crearPedidoCore (MODIFICACIÓN DE CÓDIGO EXISTENTE)

const qr = this.dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();

try {
  // ... validaciones y creación del pedido ...

  const saved = await qr.manager.save(Pedido, pedido);

  // Registrar pago dentro de la misma transacción
  if (dto.medio_pago === MedioPagoPedido.PRESENCIAL) {
    await this.pagosService.crearPagoPresencial(saved.id, saved.importe_total, tenantId, qr);
  } else {
    await this.pagosService.crearPagoOnline(saved.id, saved.importe_total, tenantId, qr);
  }

  await qr.commitTransaction();
  return saved;
} catch (err) {
  await qr.rollbackTransaction(); // Revierte pedido Y pago si algo falla
  throw err;
} finally {
  await qr.release();
}
```

## Integration Pattern: Cancelar Pedido

```typescript
// En PedidosService.cancelarDesdePortal y cancelarDesdeAdmin

// Después de repo.save(pedido):
await this.pagosService.cancelarPago(pedido.id, tenantId);
```

## PagosService: Implementación de Referencia

```typescript
// src/modules/pagos/pagos.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { AppError } from 'src/common/errors/app-error';
import { ErrorCodes } from 'src/common/errors/error-codes';
import { getTenantIdFromContext } from 'src/modules/tenancy/tenant-context'; // ajustar al helper real
import { Pago } from './entities/pago.entity';
import { EstadoPago, MedioPago } from './pago.enums';

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
  ) {}

  // Usado por el controller — lee tenant del contexto HTTP
  async findByPedidoId(pedidoId: string): Promise<Pago | null> {
    const tenantId = /* leer de tenantContext */;
    return this.pagoRepo
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId', { pedidoId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();
  }

  // Llamado desde PedidosService con qr activo
  async crearPagoPresencial(
    pedidoId: string, importe: number, tenantId: string, qr: QueryRunner,
  ): Promise<Pago> {
    const pago = qr.manager.create(Pago, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      medio_pago: MedioPago.PRESENCIAL,
      estado: EstadoPago.PRESENCIAL_PENDIENTE,
      importe,
      fecha_generacion: new Date(),
    });
    return qr.manager.save(Pago, pago);
  }

  async crearPagoOnline(
    pedidoId: string, importe: number, tenantId: string, qr: QueryRunner,
  ): Promise<Pago> {
    const pago = qr.manager.create(Pago, {
      tenant_id: tenantId,
      pedido_id: pedidoId,
      medio_pago: MedioPago.MERCADO_PAGO,
      estado: EstadoPago.PENDIENTE,
      importe,
      fecha_generacion: new Date(),
    });
    return qr.manager.save(Pago, pago);
  }

  async registrarCobroPresencial(pedidoId: string): Promise<Pago> {
    const tenantId = /* leer de tenantContext */;
    const pago = await this.findByPedidoId(pedidoId);
    if (!pago) {
      throw new AppError({ code: ErrorCodes.PAGO_NOT_FOUND, message: '...', status: 404 });
    }
    if (pago.estado !== EstadoPago.PRESENCIAL_PENDIENTE) {
      throw new AppError({ code: ErrorCodes.PAGO_YA_COBRADO, message: '...', status: 409 });
    }
    pago.estado = EstadoPago.PRESENCIAL_COBRADO;
    pago.fecha_registro_presencial = new Date();
    return this.pagoRepo.save(pago);
  }

  async actualizarEstadoOnline(
    pedidoId: string, nuevoEstado: EstadoPago, referenciaExterna?: string,
  ): Promise<Pago> {
    const pago = await this.findByPedidoId(pedidoId);
    if (!pago) {
      throw new AppError({ code: ErrorCodes.PAGO_NOT_FOUND, message: '...', status: 404 });
    }
    pago.estado = nuevoEstado;
    if (referenciaExterna) pago.referencia_externa = referenciaExterna;
    if (nuevoEstado === EstadoPago.APROBADO) pago.fecha_aprobacion = new Date();
    return this.pagoRepo.save(pago);
  }

  async cancelarPago(pedidoId: string, tenantId: string): Promise<void> {
    const pago = await this.pagoRepo
      .createQueryBuilder('p')
      .where('p.pedido_id = :pedidoId', { pedidoId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!pago) return; // Tolerante — si no hay pago, no hay nada que cancelar
    pago.estado = EstadoPago.CANCELADO;
    await this.pagoRepo.save(pago);
  }
}
```

## Cómo lee el tenantId el servicio

El servicio `PagosService` usa el mismo patrón que los demás módulos. Para el controller, se llama directamente al método que ya accede al contexto HTTP a través del `TenancyMiddleware`. Para los métodos internos, el `tenantId` se pasa como parámetro:

```typescript
// Para findByPedidoId y registrarCobroPresencial (llamados en contexto HTTP):
// Buscar cómo se llama en otros servicios del proyecto:
// Ejemplo: this.getTenantId({ strictTenant: true }) si hubiera BaseCrudTenantService
// Sin él: importar el helper de tenancy directamente del contexto
```

**Ver**: `src/modules/pedidos/pedidos.service.ts` línea ~62 — `this.getTenantId({ strictTenant: true })` — ese método viene de `BaseCrudTenantService`. Para `PagosService` hay dos alternativas:
1. Importar el store de AsyncLocalStorage directamente (ver `src/modules/tenancy/`)
2. O recibir siempre el `tenantId` como parámetro (más simple y explícito)

La implementación concreta se define en T004 del tasks.md — explorar `src/modules/tenancy/` para el patrón correcto.

## Módulo

```typescript
// src/modules/pagos/pagos.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Pago])],
  providers: [PagosService],
  controllers: [PagosController],
  exports: [PagosService],
})
export class PagosModule {}
```

## Migration

```bash
npm run db:migration:generate -- migrations/CreatePagos
# Verificar: UNIQUE(pedido_id), FK ON DELETE RESTRICT, sin deleted_at
```
