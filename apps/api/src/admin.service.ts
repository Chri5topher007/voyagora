
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const totalUsers = await this.prisma.user.count();
    const totalOrganizers = await this.prisma.user.count({ where: { role: 'ORGANIZER' } });
    const totalTours = await this.prisma.tour.count();
    const totalEvents = await this.prisma.event.count();
    
    const bookings = await this.prisma.booking.findMany();
    const platformRevenue = bookings.reduce((acc, b) => acc + b.platformFee, 0);
    const grossVolume = bookings.reduce((acc, b) => acc + b.amountPaid, 0);

    // Chart Data: Last 7 days
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayBookings = bookings.filter(b => new Date(b.createdAt).toISOString().split('T')[0] === dateString);
      
      chartData.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: dayBookings.reduce((acc, b) => acc + b.platformFee, 0),
        bookings: dayBookings.length
      });
    }

    return { totalUsers, totalOrganizers, totalTours, totalEvents, totalBookings: bookings.length, platformRevenue, grossVolume, chartData };
  }
}
