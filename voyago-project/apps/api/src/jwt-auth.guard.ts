import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Shared auth guard used across all controllers. Uses the app-wide JwtService
// (registered once in AppModule via JwtModule.register), so it always verifies
// tokens with the same secret that signed them — no more per-file hardcoded
// fallback secrets that can drift out of sync with the real JWT_SECRET.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    try {
      req.user = this.jwtService.verify(authHeader.split(' ')[1]);
      return true;
    } catch (e) {
      return false;
    }
  }
}
