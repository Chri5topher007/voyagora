
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: string, dto: { rating: number; comment: string; tourId?: string; eventId?: string }) {
    if ((!dto.tourId && !dto.eventId) || (dto.tourId && dto.eventId)) {
      throw new BadRequestException('Provide exactly one of tourId or eventId');
    }
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
