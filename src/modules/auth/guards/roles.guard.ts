import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { canonicalizeRoleName } from '../roles.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    // payload trae roles como string[]
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const userRoles = new Set(roles.map((r) => canonicalizeRoleName(r)));
    return required.some((r) => userRoles.has(canonicalizeRoleName(r)));
  }
}
