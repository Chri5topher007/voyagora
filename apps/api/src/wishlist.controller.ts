
import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
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

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly ws: WishlistService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('toggle')
  async toggle(@Request() req: any, @Body() body: { itemId: string, itemType: string }) {
    return this.ws.toggleWishlist(req.user.sub, body.itemId, body.itemType);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('mine')
  async getMine(@Request() req: any) {
    return this.ws.getMyWishlist(req.user.sub);
  }
}
