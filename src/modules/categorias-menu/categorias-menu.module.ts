import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { CategoriaMenu } from './entities/categoria-menu.entity';
import { CategoriasMenuService } from './categorias-menu.service';
import { CategoriasMenuController } from './categorias-menu.controller';
import { PublicCategoriasMenuController } from './public-categorias-menu.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoriaMenu]), AuditModule],
  providers: [CategoriasMenuService],
  controllers: [CategoriasMenuController, PublicCategoriasMenuController],
  exports: [CategoriasMenuService],
})
export class CategoriasMenuModule {}
