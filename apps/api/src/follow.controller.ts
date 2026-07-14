
import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { FollowService } from './follow.service';
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

@Controller('follow')
export class FollowController {
  constructor(private readonly fs: FollowService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post(':id')
  async toggle(@Request() req: any, @Param('id') followingId: string) {
    return this.fs.toggleFollow(req.user.sub, followingId);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('feed')
  async getFeed(@Request() req: any) {
    return this.fs.getFollowingTours(req.user.sub);
  }
}
