# Roles contract

This backend must use the same role names as Rochester Kiosco.

## Canonical roles

Role names are case-sensitive and must be stored exactly as shown:

- `Admin`
- `Vendedor`
- `Cocina`

Role IDs are local to each backend and must not be used as shared identifiers between systems. Cross-system synchronization must use the role name.

## Legacy mapping

Existing historical names map to the canonical roles as follows:

| Legacy name | Canonical role |
| --- | --- |
| `admin` | `Admin` |
| `administrador` | `Admin` |
| `supervisor` | `Admin` |
| `operador_caja` | `Vendedor` |
| `vendedor` | `Vendedor` |
| `cocina` | `Cocina` |

## Access policy

Backoffice `Cocina` access is limited to production/listing flows related to `Produccion de viandas`.

Commerce/Kiosco `Cocina` access should be absent or very limited unless a concrete operational screen requires it.
