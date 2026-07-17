const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Notification Model)
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
  createdAt          DateTime @default(now())
}
model Tour {
  id              String   @id @default(uuid())
  title           String
  description     String
  price           Float
  imageUrl        String
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
`);

// 2. CREATE NOTIFICATION SERVICE & CONTROLLER
createFile('apps/api/src/notification.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async sendNotification(userId: string, message: string) {
    return this.prisma.notification.create({
      data: { userId, message },
    });
  }

  async getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10, // Get latest 10
    });
  }

  async markAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
`);

createFile('apps/api/src/notification.controller.ts', `
import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; }
  }
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly ns: NotificationService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get()
  async getMine(@Request() req: any) { return this.ns.getMyNotifications(req.user.sub); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('read')
  async markAsRead(@Request() req: any) { return this.ns.markAsRead(req.user.sub); }
}
`);

// 3. UPDATE BOOKING SERVICE (Trigger Notification on Booking)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import Stripe from 'stripe';

@Injectable()
export class BookingService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2024-06-20' as any });
  }

  async createCheckoutSession(userId: string, itemId: string, itemType: string, travelDate?: string, couponCode?: string) {
    const item = await (this.prisma as any)[itemType].findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const basePrice = item.price;
    const gstAmount = (basePrice * (item.gstPercentage || 0)) / 100;
    let amountToPayOnline = basePrice + gstAmount;
    if (item.paymentType === 'ADVANCE') {
      amountToPayOnline = (item.advanceAmount || 0) + gstAmount;
    }
    
    let discountApplied = 0;
    if (couponCode) {
      const coupon = await this.prisma.coupon.findFirst({ where: { code: couponCode, isActive: true } });
      if (!coupon) throw new BadRequestException('Invalid Promo Code');
      discountApplied = coupon.discountAmount;
      amountToPayOnline = Math.max(0, amountToPayOnline - discountApplied);
    }

    const pendingAmount = (basePrice + gstAmount) - amountToPayOnline - (item.paymentType === 'ADVANCE' ? (item.advanceAmount || 0) : 0);
    const platformFee = amountToPayOnline * 0.05;
    const organizerPayout = amountToPayOnline - platformFee;

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: item.title + (item.paymentType === 'ADVANCE' ? ' (Advance Booking)' : ''), description: item.description.substring(0, 100) },
          unit_amount: Math.round(amountToPayOnline * 100),
        },
        quantity: 1,
      }],
      metadata: { 
        userId, itemId, itemType, travelDate: travelDate || '',
        totalAmount: basePrice.toString(),
        amountPaid: amountToPayOnline.toString(),
        pendingAmount: pendingAmount.toString(),
        platformFee: platformFee.toString(),
        organizerPayout: organizerPayout.toString(),
        gstAmount: gstAmount.toString(),
        discountApplied: discountApplied.toString()
      },
      success_url: 'http://localhost:8080/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:8080/checkout/cancel',
    });

    return { url: session.url };
  }

  async verifyAndSaveBooking(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') throw new BadRequestException('Payment not completed');

    const existing = await this.prisma.booking.findFirst({ where: { qrCode: sessionId } });
    if (existing) return existing;

    const meta = session.metadata!;
    const item = await (this.prisma as any)[meta.itemType].findUnique({ where: { id: meta.itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const qrCode = 'VOY-' + sessionId.slice(-12);

    const booking = await this.prisma.booking.create({
      data: {
        userId: meta.userId,
        [meta.itemType + 'Id']: meta.itemId,
        totalAmount: Number(meta.totalAmount),
        amountPaid: Number(meta.amountPaid),
        pendingAmount: Number(meta.pendingAmount),
        platformFee: Number(meta.platformFee),
        organizerPayout: Number(meta.organizerPayout),
        gstAmount: Number(meta.gstAmount),
        discountApplied: Number(meta.discountApplied),
        status: 'CONFIRMED',
        qrCode,
        travelDate: meta.travelDate ? new Date(meta.travelDate) : null,
      },
    });

    // Send Notifications
    await this.notificationService.sendNotification(meta.userId, '🎉 Your booking for ' + item.title + ' is confirmed!');
    await this.notificationService.sendNotification(item.organizerId, '💰 New booking received for ' + item.title + '!');

    return booking;
  }

  async getMyBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { tour: true, event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyTicket(qrCode: string) {
    const booking = await this.prisma.booking.findFirst({ where: { qrCode } });
    if (!booking) throw new NotFoundException('Invalid Ticket');
    if (booking.isCheckedIn) throw new BadRequestException('Ticket already used');
    await this.prisma.booking.update({ where: { id: booking.id }, data: { isCheckedIn: true } });
    return { success: true, message: 'Check-in successful!' };
  }
}
`);

// 4. UPDATE COMMUNITY SERVICE (Trigger Notification on Approval)
createFile('apps/api/src/community.service.ts', `
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
`);

// 5. UPDATE APP MODULE
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { UploadController } from './upload.controller';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController, NotificationController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService, NotificationService],
})
export class AppModule {}
`);

// 6. CREATE NOTIFICATION BELL COMPONENT (Frontend)
createFile('apps/web/src/components/NotificationBell.tsx', `
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch('http://localhost:3000/notifications', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: any) => !n.isRead).length);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleBellClick = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/notifications/read', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
      setUnreadCount(0);
      setTimeout(fetchNotifs, 500);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleBellClick} className="relative text-slate-700 hover:text-indigo-600 p-2 rounded-full hover:bg-slate-100 transition">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800">Notifications</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">You're all caught up! 🎉</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={"p-4 border-b border-slate-50 hover:bg-slate-50 transition " + (!n.isRead ? 'bg-indigo-50/50' : '')}>
                    <p className="text-sm text-slate-700">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
`);

console.log('\n✨ Step 34 (In-App Notifications Backend & Bell Component) successfully generated!');
