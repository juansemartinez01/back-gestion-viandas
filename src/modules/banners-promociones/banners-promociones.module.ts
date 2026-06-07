import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { Banner } from './entities/banner.entity';
import { BannersPromocionesService } from './banners-promociones.service';
import { BannersPromocionesController } from './banners-promociones.controller';
import { PublicBannersController } from './public-banners.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Banner]), AuditModule],
  providers: [BannersPromocionesService],
  controllers: [BannersPromocionesController, PublicBannersController],
  exports: [BannersPromocionesService],
})
export class BannersPromocionesModule {}
