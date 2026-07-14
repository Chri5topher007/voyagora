
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {}

  async submitPlace(userId: string, dto: any) {
    return this.prisma.communityPlace.create({
      data: { name: dto.name, description: dto.description, imageUrl: dto.imageUrl, lat: dto.lat || 0, lng: dto.lng || 0, uploadedBy: userId },
    });
  }

  async getApprovedPlaces() {
    return this.prisma.communityPlace.findMany({ where: { status: 'APPROVED' } });
  }

  async getPendingPlaces() {
    return this.prisma.communityPlace.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { name: true } } },
    });
  }

  async approvePlace(id: string) {
    const place = await this.prisma.communityPlace.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    // Send Notification to the traveler who submitted it
    await this.notificationService.sendNotification(place.uploadedBy, '✅ Your hidden gem "' + place.name + '" was approved and is now live!');

    return place;
  }
}
