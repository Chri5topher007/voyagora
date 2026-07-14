
import { Controller, Post, Get, Query, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; }
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private jwtService: JwtService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; name: string; role: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post('create-subscription-checkout')
  createCheckout(@Request() req: any, @Body() body: { tier: string }) {
    return this.authService.createSubscriptionCheckout(req.user.sub, body.tier);
  }

  @Get('verify-subscription')
  verifySubscription(@Query('session_id') sessionId: string) {
    return this.authService.verifyAndActivate(sessionId);
  }
}
