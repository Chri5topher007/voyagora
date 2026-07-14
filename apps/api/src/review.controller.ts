
import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ReviewService } from './review.service';
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

@Controller('reviews')
export class ReviewController {
  constructor(private readonly rs: ReviewService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    return this.rs.createReview(req.user.sub, body);
  }

  @Get()
  async getReviews(@Query('itemId') itemId: string, @Query('itemType') itemType: string) {
    return this.rs.getReviewsForItem(itemId, itemType);
  }
}
