# Role synchronization

Role synchronization keeps the role catalog aligned between Rochester Viandas/Backoffice and Rochester Kiosco.

## Contract

Synchronization uses exact role names, never role IDs.

Each backend exposes:

```txt
POST /internal/roles/sync
```

Headers:

```txt
x-role-sync-secret: <shared secret>
x-tenant-id: <optional tenant id required by the peer>
```

Body:

```json
{
  "name": "Cocina"
}
```

The endpoint is idempotent: if the role already exists, it returns the existing role.

## Environment variables

```txt
ROLE_SYNC_PEER_URL=http://peer-backend.example
ROLE_SYNC_SECRET=<same secret in both systems>
ROLE_SYNC_TENANT_ID=<optional tenant id for peers that require x-tenant-id>
```

If `ROLE_SYNC_PEER_URL` or `ROLE_SYNC_SECRET` is missing, outgoing synchronization is disabled.

If both are configured and the peer fails, the local request returns an error so the operation can be retried.

## Loop prevention

Normal role create/update endpoints call the peer.

The internal sync endpoint only upserts locally and does not call the peer again.
