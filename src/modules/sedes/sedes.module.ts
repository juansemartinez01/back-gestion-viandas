import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from 'src/modules/audit/audit.module';
import { Sede } from './entities/sede.entity';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { PublicSedesController } from './public-sedes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sede]), AuditModule],
  providers: [SedesService],
  controllers: [SedesController, PublicSedesController],
  exports: [SedesService],
})
export class SedesModule {}
