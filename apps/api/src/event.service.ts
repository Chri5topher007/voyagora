
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

  async createEvent(organizerId: string, dto: any) {
    return this.prisma.event.create({
      data: {
        title: dto.title, description: dto.description, price: Number(dto.price), 
        imageUrl: dto.imageUrl, gallery: dto.gallery || [],
        lat: dto.lat || 0, lng: dto.lng || 0, eventDate: new Date(dto.eventDate), organizerId,
        paymentType: dto.paymentType || 'FULL', advanceAmount: Number(dto.advanceAmount) || 0,
        gstNumber: dto.gstNumber || null, gstPercentage: Number(dto.gstPercentage) || 0,
      },
    });
  }

  async getAllEvents() {
    return this.prisma.event.findMany({
      include: { organizer: { select: { name: true } } },
      orderBy: { eventDate: 'asc' },
    });
  }
}
