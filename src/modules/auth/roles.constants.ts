export const APP_ROLES = {
  ADMIN: 'Admin',
  VENDEDOR: 'Vendedor',
  COCINA: 'Cocina',
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export const APP_ROLE_NAMES = Object.values(APP_ROLES) as AppRole[];

export const LEGACY_ROLE_NAME_MAP: Readonly<Record<string, AppRole>> = {
  admin: APP_ROLES.ADMIN,
  administrador: APP_ROLES.ADMIN,
  supervisor: APP_ROLES.ADMIN,
  operador_caja: APP_ROLES.VENDEDOR,
  vendedor: APP_ROLES.VENDEDOR,
  cocina: APP_ROLES.COCINA,
};

export function canonicalizeRoleName(name: string): AppRole | string {
  const trimmed = name.trim();
  return LEGACY_ROLE_NAME_MAP[trimmed.toLowerCase()] ?? trimmed;
}

export function isAppRole(name: string): name is AppRole {
  return (APP_ROLE_NAMES as readonly string[]).includes(name);
}
