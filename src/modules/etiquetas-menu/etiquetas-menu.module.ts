import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { EtiquetaMenu } from './entities/etiqueta-menu.entity';
import { EtiquetasMenuService } from './etiquetas-menu.service';
import { EtiquetasMenuController } from './etiquetas-menu.controller';
import { PublicEtiquetasMenuController } from './public-etiquetas-menu.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EtiquetaMenu]), AuditModule],
  providers: [EtiquetasMenuService],
  controllers: [EtiquetasMenuController, PublicEtiquetasMenuController],
  exports: [EtiquetasMenuService],
})
export class EtiquetasMenuModule {}
