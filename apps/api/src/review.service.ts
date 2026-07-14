
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: string, dto: { rating: number; comment: string; tourId?: string; eventId?: string }) {
    return this.prisma.review.create({
      data: { ...dto, userId },
    });
  }

  async getReviewsForItem(itemId: string, itemType: string) {
    return this.prisma.review.findMany({
      where: { [itemType + 'Id']: itemId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
