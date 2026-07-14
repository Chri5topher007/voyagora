
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}

  async createTour(organizerId: string, dto: any) {
    return this.prisma.tour.create({
      data: {
        title: dto.title, description: dto.description, price: Number(dto.price), 
        imageUrl: dto.imageUrl, gallery: dto.gallery || [],
        lat: dto.lat || 0, lng: dto.lng || 0, organizerId,
        paymentType: dto.paymentType || 'FULL', advanceAmount: Number(dto.advanceAmount) || 0,
        gstNumber: dto.gstNumber || null, gstPercentage: Number(dto.gstPercentage) || 0,
      },
    });
  }

  async getAllTours(query: { search?: string; maxPrice?: string }) {
    const where: any = {};
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.maxPrice) {
      where.price = { lte: Number(query.maxPrice) };
    }

    const tours = await this.prisma.tour.findMany({
      where,
      include: { organizer: { select: { name: true, profileImageUrl: true } }, reviews: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return tours.map(t => {
      const avgRating = t.reviews.length > 0 ? t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length : 0;
      return { ...t, avgRating: avgRating.toFixed(1), reviewCount: t.reviews.length };
    });
  }

  async getTourById(id: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      include: { 
        organizer: { select: { name: true, profileImageUrl: true, bio: true } }, 
        reviews: { include: { user: { select: { name: true, profileImageUrl: true } } }, orderBy: { createdAt: 'desc' } } 
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    
    const avgRating = tour.reviews.length > 0 ? tour.reviews.reduce((acc, r) => acc + r.rating, 0) / tour.reviews.length : 0;
    return { ...tour, avgRating: avgRating.toFixed(1), reviewCount: tour.reviews.length };
  }

  async getOrganizerStats(organizerId: string) {
    const tours = await this.prisma.tour.findMany({ where: { organizerId }, select: { id: true } });
    const events = await this.prisma.event.findMany({ where: { organizerId }, select: { id: true } });
    const tourIds = tours.map(t => t.id);
    const eventIds = events.map(e => e.id);
    
    const bookings = await this.prisma.booking.findMany({
      where: { OR: [{ tourId: { in: tourIds } }, { eventId: { in: eventIds } }] },
    });

    const totalRevenue = bookings.reduce((acc, b) => acc + b.organizerPayout, 0);
    
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayBookings = bookings.filter(b => new Date(b.createdAt).toISOString().split('T')[0] === dateString);
      
      chartData.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: dayBookings.reduce((acc, b) => acc + b.organizerPayout, 0),
        bookings: dayBookings.length
      });
    }

    return { totalRevenue, totalBookings: bookings.length, activeTours: tours.length, upcomingEvents: events.length, chartData };
  }
}
