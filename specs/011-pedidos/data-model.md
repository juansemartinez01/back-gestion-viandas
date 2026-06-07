# Data Model: Pedidos

**Feature**: 011-pedidos | **Date**: 2026-06-07

## Enums — `pedido.enums.ts`

```typescript
export enum EstadoPedido {
  PENDIENTE_PAGO_ONLINE     = 'pendiente_pago_online',
  CONFIRMADO_PAGO_ONLINE    = 'confirmado_pago_online',
  CONFIRMADO_PAGO_PRESENCIAL = 'confirmado_pago_presencial',
  ENTREGADO                 = 'entregado',
  NO_RETIRADO               = 'no_retirado',
  CANCELADO                 = 'cancelado',
}

export enum EstadoPagoPedido {
  PENDIENTE           = 'pendiente',
  APROBADO            = 'aprobado',
  RECHAZADO           = 'rechazado',
  CANCELADO           = 'cancelado',
  PRESENCIAL_PENDIENTE = 'presencial_pendiente',
  PRESENCIAL_COBRADO   = 'presencial_cobrado',
}

export enum MedioPagoPedido {
  MERCADO_PAGO = 'mercado_pago',
  PRESENCIAL   = 'presencial',
}

export enum OrigenCancelacion {
  CLIENTE       = 'cliente',
  ADMINISTRACION = 'administracion',
}
```

## Entity — `Pedido`

**Tabla PostgreSQL**: `pedidos`

Extiende `BaseEntity` (`id` uuid PK, `tenant_id` uuid, `created_at`, `updated_at`, `deleted_at` — soft delete)

| Campo | Tipo PostgreSQL | TypeORM | Nullable | Descripción |
|-------|----------------|---------|----------|-------------|
| `codigo_publico` | varchar(30) | `@Unique` | NO | Formato `VIA-YYYY-NNNNNN`, único por tenant+año |
| `cliente_id` | uuid | FK → clientes | NO | UUID del cliente upsertado |
| `menu_publicado_id` | uuid | FK → menus_publicados | NO | Menú al que pertenece el pedido |
| `sede_id` | uuid | FK → sedes | NO | Sede del menú publicado (desnormalizado) |
| `punto_retiro_id` | uuid | FK → puntos_retiro | NO | Punto de retiro elegido |
| `dni_informado` | varchar(20) | | NO | DNI al momento del pedido |
| `nombre_informado` | varchar(100) | | NO | |
| `apellido_informado` | varchar(100) | | NO | |
| `telefono_informado` | varchar(50) | | SÍ | |
| `email_informado` | varchar(200) | | SÍ | |
| `fecha_pedido` | date | | NO | Fecha de creación del pedido (no timestamp) |
| `fecha_retiro` | date | | NO | Fecha de retiro = fecha_venta del menú publicado |
| `cantidad` | int | | NO | Cantidad de viandas |
| `precio_unitario` | decimal(10,2) | | NO | Copiado de `menu_publicado.precio_encargo` en la creación; INMUTABLE |
| `importe_total` | decimal(10,2) | | NO | `precio_unitario × cantidad`; INMUTABLE |
| `medio_pago` | enum `MedioPagoPedido` | | NO | |
| `estado_pedido` | enum `EstadoPedido` | default `pendiente_pago_online` | NO | |
| `estado_pago` | enum `EstadoPagoPedido` | | NO | |
| `expires_at` | timestamptz | | SÍ | Solo para `medio_pago = mercado_pago`: `now() + 15min` |
| `fecha_confirmacion` | timestamptz | | SÍ | Cuando pasa a estado confirmado |
| `fecha_cancelacion` | timestamptz | | SÍ | |
| `cancelado_por` | enum `OrigenCancelacion` | | SÍ | |
| `usuario_cancelacion_id` | uuid | | SÍ | Solo para cancelaciones desde admin |
| `motivo_cancelacion` | text | | SÍ | |
| `devolucion_pendiente` | boolean | default false | NO | Marca devolución manual cuando se cancela con pago aprobado |

### Índices

```typescript
@Index(['tenant_id', 'dni_informado'])
@Index(['tenant_id', 'menu_publicado_id', 'estado_pedido'])
@Index(['tenant_id', 'expires_at'])   // para el job de expiración
```

Nota: `codigo_publico` ya tiene `@Unique()` — TypeORM genera índice único simple.

### Relaciones (solo para `findOne`)

```typescript
@ManyToOne(() => MenuPublicado)   @JoinColumn({ name: 'menu_publicado_id' })
@ManyToOne(() => Sede)            @JoinColumn({ name: 'sede_id' })
@ManyToOne(() => PuntoRetiro)     @JoinColumn({ name: 'punto_retiro_id' })
@ManyToOne(() => Cliente)         @JoinColumn({ name: 'cliente_id' })
```

Todas `eager: false` — se cargan solo cuando se hace el LEFT JOIN explícito en `findOne`.

## State Machine — `EstadoPedido`

```
                        [PRESENCIAL]
CREATE ─────────────────────────────────► confirmado_pago_presencial ──► entregado
                                                     │                      │
CREATE ─[MERCADO PAGO]──► pendiente_pago_online      │                      │
                               │  │                  │                      │
                     [15min]   │  │[MP webhook]      │                      │
                  expires_at   │  └──► confirmado_pago_online ──► entregado │
                               │                     │                      │
                               └──────────────────── │ ─────────────────────┘
                                                      ▼
                                                   cancelado
                                                      ▼
                                                 no_retirado (Stage 6)
```

**Transiciones válidas**:

| Desde | Hacia | Quién |
|-------|-------|-------|
| `pendiente_pago_online` | `confirmado_pago_online` | Stage 4 (MP webhook) |
| `pendiente_pago_online` | `cancelado` | Job (expiración) / Portal / Admin |
| `confirmado_pago_online` | `entregado` | Stage 6 (entregas) |
| `confirmado_pago_online` | `cancelado` | Admin |
| `confirmado_pago_presencial` | `entregado` | Stage 6 (entregas) |
| `confirmado_pago_presencial` | `cancelado` | Portal / Admin |
| `entregado` | — | TERMINAL — no cancelable |
| `cancelado` | — | TERMINAL — no cancelable |

## Error Codes a agregar en `error-codes.ts`

```typescript
// pedidos
PEDIDO_NOT_FOUND: 'PEDIDO_NOT_FOUND',                            // 404
PEDIDO_MENU_NO_DISPONIBLE: 'PEDIDO_MENU_NO_DISPONIBLE',          // 409
PEDIDO_PUNTO_RETIRO_NO_HABILITADO: 'PEDIDO_PUNTO_RETIRO_NO_HABILITADO', // 422
PEDIDO_CAPACIDAD_AGOTADA: 'PEDIDO_CAPACIDAD_AGOTADA',            // 409
PEDIDO_NO_CANCELABLE: 'PEDIDO_NO_CANCELABLE',                    // 409
PEDIDO_FUERA_DE_VENTANA_CANCELACION: 'PEDIDO_FUERA_DE_VENTANA_CANCELACION', // 409
PEDIDO_RESERVA_EXPIRADA: 'PEDIDO_RESERVA_EXPIRADA',              // 409
PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL: 'PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL', // 422
```

## Service Method Signatures

```typescript
class PedidosService extends BaseCrudTenantService<Pedido> {
  // Generación de código — llamar dentro de transacción activa
  async generarCodigoPublico(tenantId: string, year: number, qr: QueryRunner): Promise<string>

  // Creación
  async crearPedidoPublico(dto: CreatePedidoPublicoDto): Promise<Pedido>
  async crearPedidoManual(dto: CreatePedidoManualDto, usuarioId: string): Promise<Pedido>

  // Consulta
  async list(query: QueryPedidoDto): Promise<{ items: Pedido[]; total: number; page: number; limit: number }>
  async findOne(id: string): Promise<Pedido>
  async consultarPorDni(dni: string): Promise<Pedido[]>

  // Cancelación
  async cancelarDesdePortal(id: string, dto?: CancelarPedidoDto): Promise<Pedido>
  async cancelarDesdeAdmin(id: string, dto: CancelarPedidoDto, usuarioId: string): Promise<Pedido>

  // Edición
  async updatePedido(id: string, dto: UpdatePedidoDto): Promise<Pedido>
}
```

## DTOs

### `CreatePedidoPublicoDto`
```typescript
menu_publicado_id: string     // @IsUUID
punto_retiro_id: string       // @IsUUID
dni: string                   // @IsString, @IsNotEmpty, @MaxLength(20)
nombre: string                // @IsString, @IsNotEmpty, @MaxLength(100)
apellido: string              // @IsString, @IsNotEmpty, @MaxLength(100)
telefono?: string             // @IsOptional, @IsString, @MaxLength(50)
email?: string                // @IsOptional, @IsEmail, @MaxLength(200)
cantidad: number              // @IsInt, @Min(1)
medio_pago: MedioPagoPedido   // @IsEnum(MedioPagoPedido)
```

### `CreatePedidoManualDto`
Igual que `CreatePedidoPublicoDto` — el service valida en runtime que `medio_pago === presencial` y lanza `PEDIDO_SOLO_PAGO_PRESENCIAL_MANUAL` si no.

### `UpdatePedidoDto`
```typescript
telefono_informado?: string   // @IsOptional, @IsString
email_informado?: string      // @IsOptional, @IsEmail
motivo?: string               // @IsOptional, @IsString (observaciones/corrección)
```
**NUNCA incluir** `precio_unitario`, `importe_total`, `estado_pedido`, `estado_pago`.

### `QueryPedidoDto`
Extiende `PageQueryDto` más:
```typescript
fecha_retiro?: string         // @IsOptional, @IsDateString
sede_id?: string              // @IsOptional, @IsUUID
punto_retiro_id?: string      // @IsOptional, @IsUUID
estado_pedido?: EstadoPedido  // @IsOptional, @IsEnum
estado_pago?: EstadoPagoPedido // @IsOptional, @IsEnum
menu_publicado_id?: string    // @IsOptional, @IsUUID
dni?: string                  // @IsOptional, @IsString — ILIKE en dni_informado
```

### `CancelarPedidoDto`
```typescript
motivo?: string               // @IsOptional, @IsString
```
