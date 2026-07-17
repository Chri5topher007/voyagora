
import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { FollowService } from './follow.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('follow')
export class FollowController {
  constructor(private readonly fs: FollowService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id')
  async toggle(@Request() req: any, @Param('id') followingId: string) {
    return this.fs.toggleFollow(req.user.sub, followingId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  async getFeed(@Request() req: any) {
    return this.fs.getFollowingTours(req.user.sub);
  }
}
