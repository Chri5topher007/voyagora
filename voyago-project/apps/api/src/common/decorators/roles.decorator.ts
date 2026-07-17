import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Usage: @Roles('ORGANIZER') or @Roles('ORGANIZER', 'ADMIN')
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
