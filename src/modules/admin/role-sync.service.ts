import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RoleSyncService {
  constructor(private readonly cfg: ConfigService) {}

  async syncRoleName(name: string) {
    const peerUrl = this.getString('rolesSync.peerUrl', 'ROLE_SYNC_PEER_URL');
    const secret = this.getString('rolesSync.secret', 'ROLE_SYNC_SECRET');
    const tenantId = this.getString(
      'rolesSync.tenantId',
      'ROLE_SYNC_TENANT_ID',
    );

    if (!peerUrl || !secret) {
      return { enabled: false };
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-role-sync-secret': secret,
      'x-role-sync-source': 'backend-rochester',
    };

    if (tenantId) headers['x-tenant-id'] = tenantId;

    const res = await fetch(
      `${peerUrl.replace(/\/+$/, '')}/internal/roles/sync`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadGatewayException({
        message: 'Role sync failed',
        peerStatus: res.status,
        peerBody: body.slice(0, 500),
      });
    }

    return { enabled: true };
  }

  private getString(configKey: string, envKey: string): string | null {
    const value = this.cfg.get<string>(configKey) ?? process.env[envKey];
    const trimmed = value?.trim();
    return trimmed || null;
  }
}
