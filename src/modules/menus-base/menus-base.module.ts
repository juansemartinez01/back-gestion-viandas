import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuBase } from './entities/menu-base.entity';
import { CategoriaMenu } from 'src/modules/categorias-menu/entities/categoria-menu.entity';
import { EtiquetaMenu } from 'src/modules/etiquetas-menu/entities/etiqueta-menu.entity';
import { Alergeno } from 'src/modules/alergenos/entities/alergeno.entity';
import { AuditModule } from 'src/modules/audit/audit.module';
import { MenusBaseService } from './menus-base.service';
import { MenusBaseController } from './menus-base.controller';
import { PublicMenusBaseController } from './public-menus-base.controller';

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
