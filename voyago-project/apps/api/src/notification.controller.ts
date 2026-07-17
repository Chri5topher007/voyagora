
import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly ns: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getMine(@Request() req: any) { return this.ns.getMyNotifications(req.user.sub); }

  @UseGuards(JwtAuthGuard)
  @Post('read')
  async markAsRead(@Request() req: any) { return this.ns.markAsRead(req.user.sub); }
}
