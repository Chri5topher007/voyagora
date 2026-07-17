
import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ReviewService } from './review.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CreateReviewDto, GetReviewsQueryDto } from './common/dto/misc.dto';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly rs: ReviewService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() body: CreateReviewDto) {
    return this.rs.createReview(req.user.sub, body);
  }

  @Get()
  async getReviews(@Query() query: GetReviewsQueryDto) {
    return this.rs.getReviewsForItem(query.itemId, query.itemType);
  }
}
