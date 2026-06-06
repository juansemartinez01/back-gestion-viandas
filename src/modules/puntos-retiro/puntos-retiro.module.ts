import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { SedesModule } from 'src/modules/sedes/sedes.module';
import { PuntoRetiro } from './entities/punto-retiro.entity';
import { PuntosRetiroService } from './puntos-retiro.service';
import { PuntosRetiroController } from './puntos-retiro.controller';
import { PublicPuntosRetiroController } from './public-puntos-retiro.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PuntoRetiro]), AuditModule, SedesModule],
  providers: [PuntosRetiroService],
  controllers: [PuntosRetiroController, PublicPuntosRetiroController],
  exports: [PuntosRetiroService],
})
export class PuntosRetiroModule {}
