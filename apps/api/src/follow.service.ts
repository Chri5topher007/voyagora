
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class FollowService {
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {}

  async toggleFollow(followerId: string, followingId: string) {
    const existing = await this.prisma.follow.findFirst({
      where: { followerId, followingId },
    });

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      return { following: false };
    } else {
      await this.prisma.follow.create({ data: { followerId, followingId } });
      const follower = await this.prisma.user.findUnique({ where: { id: followerId } });
      const followerName = follower?.name || 'Someone';
      await this.notificationService.sendNotification(followingId, '🤝 ' + followerName + ' is now following you!');
      return { following: true };
    }
  }

  async getFollowingTours(userId: string) {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const organizerIds = follows.map(f => f.followingId);
    
    return this.prisma.tour.findMany({
      where: { organizerId: { in: organizerIds } },
      include: { organizer: { select: { name: true, profileImageUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
