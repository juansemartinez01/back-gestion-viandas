import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuPublicado } from './entities/menu-publicado.entity';
import { MenuBase } from 'src/modules/menus-base/entities/menu-base.entity';
import { Sede } from 'src/modules/sedes/entities/sede.entity';
import { PuntoRetiro } from 'src/modules/puntos-retiro/entities/punto-retiro.entity';
import { MenusBaseModule } from 'src/modules/menus-base/menus-base.module';
import { SedesModule } from 'src/modules/sedes/sedes.module';
import { PuntosRetiroModule } from 'src/modules/puntos-retiro/puntos-retiro.module';
import { AuditModule } from 'src/modules/audit/audit.module';
import { MenusPublicadosService } from './menus-publicados.service';
import { MenusPublicadosController } from './menus-publicados.controller';
import { PublicMenusPublicadosController } from './public-menus-publicados.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuPublicado, MenuBase, Sede, PuntoRetiro]),
    MenusBaseModule,
    SedesModule,
    PuntosRetiroModule,
    AuditModule,
  ],
  providers: [MenusPublicadosService],
  controllers: [MenusPublicadosController, PublicMenusPublicadosController],
  exports: [MenusPublicadosService],
})
export class MenusPublicadosModule {}
