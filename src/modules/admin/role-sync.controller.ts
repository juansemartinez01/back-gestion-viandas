import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { SyncRoleAdminDto } from './dto/sync-role.admin.dto';

@Controller('internal/roles')
export class RoleSyncController {
  constructor(
    private readonly users: UsersService,
    private readonly cfg: ConfigService,
  ) {}

  @Post('sync')
  async sync(
    @Headers('x-role-sync-secret') receivedSecret: string | undefined,
    @Body() dto: SyncRoleAdminDto,
  ) {
    const expectedSecret = this.cfg.get<string>('rolesSync.secret')?.trim();
    if (!expectedSecret || receivedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid role sync secret');
    }

    const role = await this.users.createRole(dto.name);
    return { ok: true, item: { id: role.id, name: role.name } };
  }
}
