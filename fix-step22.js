const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FIX TOUR SERVICE (Strictly map fields to prevent Prisma crash)
createFile('apps/api/src/tour.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}

  async createTour(organizerId: string, dto: any) {
    return this.prisma.tour.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        lat: dto.lat || 0,
        lng: dto.lng || 0,
        organizerId,
      },
    });
  }

  async getAllTours() {
    return this.prisma.tour.findMany({
      include: { organizer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
`);

// 2. FIX EVENT SERVICE (Strictly map fields)
createFile('apps/api/src/event.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

  async createEvent(organizerId: string, dto: any) {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        lat: dto.lat || 0,
        lng: dto.lng || 0,
        eventDate: new Date(dto.eventDate),
        organizerId,
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
`);

console.log('\n✨ Step 22 (Tour/Event Save Fix) successfully patched!');
