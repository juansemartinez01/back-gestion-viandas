import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminRolesController } from './admin-roles.controller';
import { AuditModule } from '../audit/audit.module';
import { RoleSyncController } from './role-sync.controller';
import { RoleSyncService } from './role-sync.service';

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AdminUsersController, AdminRolesController, RoleSyncController],
  providers: [RoleSyncService],
})
export class AdminModule {}
