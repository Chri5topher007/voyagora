const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Gallery Array to Tour & Event)
createFile('apps/api/prisma/schema.prisma', `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
generator client {
  provider = "prisma-client-js"
}
model User {
  id                 String   @id @default(uuid())
  email              String   @unique
  password           String
  name               String
  role               String   @default("TRAVELER")
  subscriptionStatus String   @default("INACTIVE")
  profileImageUrl    String?
  bio                String?
  tours              Tour[]
  events             Event[]
  bookings           Booking[]
  places             CommunityPlace[]
  reviews            Review[]
  wishlist           Wishlist[]
  notifications      Notification[]
  following          Follow[] @relation("Follower")
  followers          Follow[] @relation("Following")
  createdAt          DateTime @default(now())
}
model Tour {
  id              String   @id @default(uuid())
  title           String
  description     String
  price           Float
  imageUrl        String
  gallery         String[] @default([])
  lat             Float    @default(0)
  lng             Float    @default(0)
  organizerId     String
  organizer       User     @relation(fields: [organizerId], references: [id])
  bookings        Booking[]
  reviews         Review[]
  wishlist        Wishlist[]
  paymentType     String   @default("FULL")
  advanceAmount   Float    @default(0)
  gstNumber       String?
  gstPercentage   Float    @default(0)
  createdAt       DateTime @default(now())
}
model Event {
  id              String   @id @default(uuid())
  title           String
  description     String
  price           Float
  imageUrl        String
  gallery         String[] @default([])
  lat             Float    @default(0)
  lng             Float    @default(0)
  eventDate       DateTime
  organizerId     String
  organizer       User     @relation(fields: [organizerId], references: [id])
  bookings        Booking[]
  reviews         Review[]
  wishlist        Wishlist[]
  paymentType     String   @default("FULL")
  advanceAmount   Float    @default(0)
  gstNumber       String?
  gstPercentage   Float    @default(0)
  createdAt       DateTime @default(now())
}
model Booking {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  tourId          String?
  tour            Tour?    @relation(fields: [tourId], references: [id])
  eventId         String?
  event           Event?   @relation(fields: [eventId], references: [id])
  totalAmount     Float
  amountPaid      Float
  pendingAmount   Float
  platformFee     Float
  organizerPayout Float
  gstAmount       Float
  discountApplied Float    @default(0)
  status          String   @default("CONFIRMED")
  qrCode          String   @unique
  isCheckedIn     Boolean  @default(false)
  travelDate      DateTime?
  createdAt       DateTime @default(now())
}
model CommunityPlace {
  id          String   @id @default(uuid())
  name        String
  description String
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  status      String   @default("PENDING")
  uploadedBy  String
  user        User     @relation(fields: [uploadedBy], references: [id])
  createdAt   DateTime @default(now())
}
model Review {
  id        String   @id @default(uuid())
  rating    Int
  comment   String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tourId    String?
  tour      Tour?    @relation(fields: [tourId], references: [id])
  eventId   String?
  event     Event?   @relation(fields: [eventId], references: [id])
  createdAt DateTime @default(now())
}
model Wishlist {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tourId    String?
  tour      Tour?    @relation(fields: [tourId], references: [id])
  eventId   String?
  event     Event?   @relation(fields: [eventId], references: [id])
  createdAt DateTime @default(now())
}
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}
model Coupon {
  id             String   @id @default(uuid())
  code           String   @unique
  discountAmount Float
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
}
model Follow {
  id          String   @id @default(uuid())
  followerId  String
  follower    User     @relation("Follower", fields: [followerId], references: [id])
  followingId String
  following   User     @relation("Following", fields: [followingId], references: [id])
  createdAt   DateTime @default(now())
}
`);

// 2. UPDATE UPLOAD CONTROLLER (Accept Multiple Files)
createFile('apps/api/src/upload.controller.ts', `
import { Controller, Post, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Controller('uploads')
export class UploadController {
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, { // Accept up to 10 files at once
    storage: new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'voyagora',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      } as any,
    }),
  }))
  uploadFiles(@UploadedFiles() files: any[]) {
    // Return an array of secure URLs
    return { urls: files.map(file => file.path) };
  }
}
`);

// 3. UPDATE TOUR & EVENT SERVICES (Save Gallery Array)
createFile('apps/api/src/tour.service.ts', `
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
`);

createFile('apps/api/src/event.service.ts', `
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
`);

// 4. UPDATE IMAGE UPLOAD COMPONENT (Support Multiple Files)
createFile('apps/web/src/components/ImageUpload.tsx', `
import { useState } from 'react';

export default function ImageUpload({ onUpload, multiple = false }: { onUpload: (data: string | string[]) => void, multiple?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: any) => {
    setLoading(true);
    const files = Array.from(e.target.files);
    const formData = new FormData();
    files.forEach((file: any) => formData.append('files', file)); // Backend expects 'files'

    try {
      const res = await fetch('http://localhost:3000/uploads', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (multiple) {
        onUpload(data.urls); // Return array of URLs
      } else {
        onUpload(data.urls[0]); // Return single URL for cover image
      }
    } catch (err) {
      alert('Upload failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        multiple={multiple} 
        onChange={handleFile} 
        className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
      />
      {loading && <p className="text-slate-400 text-sm mt-2">Uploading to cloud...</p>}
    </div>
  );
}
`);

console.log('\n✨ Step 48 (Multiple Image Uploads Backend & Component) successfully generated!');
