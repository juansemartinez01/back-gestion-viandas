import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DbModule } from './infra/db/db.module';
import { HealthModule } from './infra/health/health.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { LoggingModule } from './infra/logging/logging.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { FilesModule } from './modules/files/files.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { SedesModule } from './modules/sedes/sedes.module';
import { PuntosRetiroModule } from './modules/puntos-retiro/puntos-retiro.module';
import { CategoriasMenuModule } from './modules/categorias-menu/categorias-menu.module';
import { EtiquetasMenuModule } from './modules/etiquetas-menu/etiquetas-menu.module';
import { AlergenosModule } from './modules/alergenos/alergenos.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { MenusBaseModule } from './modules/menus-base/menus-base.module';
import { MenusPublicadosModule } from './modules/menus-publicados/menus-publicados.module';
import { BannersPromocionesModule } from './modules/banners-promociones/banners-promociones.module';
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { MercadoPagoModule } from './modules/mercado-pago/mercado-pago.module';
import { CancelacionesPedidosModule } from './modules/cancelaciones-pedidos/cancelaciones-pedidos.module';
import { ProduccionViandasModule } from './modules/produccion-viandas/produccion-viandas.module';
import { StockViandasModule } from './modules/stock-viandas/stock-viandas.module';

import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ObservabilityModule } from './infra/observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),

    // ✅ Rate limit base (global)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const ttl = Number(cfg.get('THROTTLE_TTL') ?? 60); // seconds
        const limit = Number(cfg.get('THROTTLE_LIMIT') ?? 300); // req/ttl por IP
        return [{ ttl, limit }];
      },
    }),

    LoggingModule,
    DbModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AdminModule,
    AuditModule,
    FilesModule,
    TenancyModule,
    ObservabilityModule,
    SedesModule,
    PuntosRetiroModule,
    CategoriasMenuModule,
    EtiquetasMenuModule,
    AlergenosModule,
    ClientesModule,
    MenusBaseModule,
    MenusPublicadosModule,
    BannersPromocionesModule,
    PedidosModule,
    PagosModule,
    MercadoPagoModule,
    CancelacionesPedidosModule,
    ProduccionViandasModule,
    StockViandasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },

    // ✅ Guard global de throttling (se puede ajustar por endpoint con @Throttle)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
