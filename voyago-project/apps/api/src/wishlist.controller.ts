
import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ToggleWishlistDto } from './common/dto/misc.dto';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly ws: WishlistService) {}

  @UseGuards(JwtAuthGuard)
  @Post('toggle')
  async toggle(@Request() req: any, @Body() body: ToggleWishlistDto) {
    return this.ws.toggleWishlist(req.user.sub, body.itemId, body.itemType);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async getMine(@Request() req: any) {
    return this.ws.getMyWishlist(req.user.sub);
  }
}
