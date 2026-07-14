
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async toggleWishlist(userId: string, itemId: string, itemType: string) {
    const existing = await this.prisma.wishlist.findFirst({
      where: { userId, [itemType + 'Id']: itemId }
    });

    if (existing) {
      await this.prisma.wishlist.delete({ where: { id: existing.id } });
      return { saved: false };
    } else {
      await this.prisma.wishlist.create({
        data: { userId, [itemType + 'Id']: itemId }
      });
      return { saved: true };
    }
  }

  async getMyWishlist(userId: string) {
    const items = await this.prisma.wishlist.findMany({
      where: { userId },
      include: { tour: { include: { organizer: { select: { name: true } } } }, event: { include: { organizer: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(i => ({ id: i.id, tour: i.tour, event: i.event }));
  }
}
