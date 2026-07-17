
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}
  async createEvent(organizerId: string, dto: any) { return this.prisma.event.create({ data: { title: dto.title, description: dto.description, price: Number(dto.price), imageUrl: dto.imageUrl, gallery: dto.gallery || [], lat: dto.lat || 0, lng: dto.lng || 0, eventDate: new Date(dto.eventDate), organizerId, paymentType: dto.paymentType || 'FULL', advanceAmount: Number(dto.advanceAmount) || 0, gstNumber: dto.gstNumber || null, gstPercentage: Number(dto.gstPercentage) || 0 } }); }
  
  async getAllEvents() { return this.prisma.event.findMany({ include: { organizer: { select: { name: true } } }, orderBy: { eventDate: 'asc' } }); }

  async getEventById(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: { organizer: { select: { name: true, profileImageUrl: true, bio: true } }, reviews: { include: { user: { select: { name: true, profileImageUrl: true } } }, orderBy: { createdAt: 'desc' } } } });
    if (!event) throw new NotFoundException('Event not found');
    const avgRating = event.reviews.length > 0 ? event.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / event.reviews.length : 0;
    return { ...event, avgRating: avgRating.toFixed(1), reviewCount: event.reviews.length };
  }

  async deleteEvent(id: string, organizerId: string) { const event = await this.prisma.event.findUnique({ where: { id } }); if (!event) throw new NotFoundException('Event not found'); if (event.organizerId !== organizerId) throw new ForbiddenException('You do not own this event'); return this.prisma.event.delete({ where: { id } }); }
}
