import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { Alergeno } from './entities/alergeno.entity';
import { AlergenosService } from './alergenos.service';
import { AlergenosController } from './alergenos.controller';
import { PublicAlergenosController } from './public-alergenos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Alergeno]), AuditModule],
  providers: [AlergenosService],
  controllers: [AlergenosController, PublicAlergenosController],
  exports: [AlergenosService],
})
export class AlergenosModule {}
