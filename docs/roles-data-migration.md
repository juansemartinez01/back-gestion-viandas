# Roles data migration

Stage 3 migrates role data to the shared canonical names:

- `Admin`
- `Vendedor`
- `Cocina`

## Backend-specific identifiers

Viandas/Backoffice uses UUID role IDs in `roles.id`.

Kiosco uses integer role IDs in `roles.id`.

Because IDs differ between systems, cross-system behavior must use exact role names as the shared identifier.

## Migration behavior

The migration creates missing canonical roles, moves user-role assignments from legacy roles to canonical roles, removes legacy user-role assignments, and deletes now-unused legacy role rows.

Legacy mapping:

| Legacy names | Canonical role |
| --- | --- |
| `admin`, `administrador`, `supervisor` | `Admin` |
| `operador_caja`, `vendedor` | `Vendedor` |
| `cocina` | `Cocina` |

The migration compares legacy names case-insensitively, but never deletes the exact canonical names `Admin`, `Vendedor`, or `Cocina`.

## Compatibility notes

Existing JWT access tokens issued before this migration may still contain legacy role names. Users should log in again after deploy so new tokens include canonical role names.

Application code must stop lowercasing canonical role names before role creation or updates in the implementation stage.

Endpoint decorators must be updated only after this migration is ready to run in the target environment.
