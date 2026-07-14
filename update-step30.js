const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Coupon Model)
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
model Coupon {
  id             String   @id @default(uuid())
  code           String   @unique
  discountAmount Float
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
}
`);

// 2. UPDATE BOOKING SERVICE (Apply Coupon Logic)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BookingService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService) {
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

    return this.prisma.booking.create({
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

// 3. UPDATE BOOKING CONTROLLER (Pass coupon code)
createFile('apps/api/src/booking.controller.ts', `
import { Controller, Post, Get, Query, Body, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
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

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('checkout')
  async createCheckout(@Request() req: any, @Body() body: { itemId: string, itemType: string, travelDate?: string, couponCode?: string }) {
    return this.bookingService.createCheckoutSession(req.user.sub, body.itemId, body.itemType, body.travelDate, body.couponCode);
  }

  @Get('verify')
  async verify(@Query('session_id') sessionId: string) {
    return this.bookingService.verifyAndSaveBooking(sessionId);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('mine')
  async getMyBookings(@Request() req: any) {
    return this.bookingService.getMyBookings(req.user.sub);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('verify')
  async verifyTicket(@Body() body: { qrCode: string }) {
    return this.bookingService.verifyTicket(body.qrCode);
  }
}
`);

// 4. UPDATE MAIN.TS (Seed default coupon VOYAGORA100)
createFile('apps/api/src/main.ts', `
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  
  const prismaService = app.get(PrismaService);
  
  // Seed default coupon
  const couponExists = await prismaService.coupon.findUnique({ where: { code: 'VOYAGORA100' } });
  if (!couponExists) {
    await prismaService.coupon.create({ data: { code: 'VOYAGORA100', discountAmount: 100 } });
    console.log('🎟️ Default coupon VOYAGORA100 created!');
  }

  await app.listen(3000);
  console.log('🚀 Voyagora API running on http://localhost:3000');
}
bootstrap();
`);

// 5. UPDATE CHECKOUT PAGE (Add Promo Code Input UI)
createFile('apps/web/src/pages/Checkout.tsx', `
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const tour = location.state?.tour;
  const event = location.state?.event;
  const item = tour || event;
  const [loading, setLoading] = useState(false);
  const [travelDate, setTravelDate] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);

  if (!item) { navigate('/'); return null; }

  const isAdvance = item.paymentType === 'ADVANCE';
  const basePrice = item.price;
  const gst = (basePrice * (item.gstPercentage || 0)) / 100;
  let amountPayableNow = isAdvance ? (item.advanceAmount + gst) : (basePrice + gst);
  
  if (appliedDiscount > 0) {
    amountPayableNow = Math.max(0, amountPayableNow - appliedDiscount);
  }
  
  const pendingAmount = isAdvance ? (basePrice + gst) - (item.advanceAmount + gst) : 0;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple frontend validation for the default coupon.
    // In a real app, you'd fetch /coupons/validate, but we pass it to the backend on checkout.
    if (promoCode.toUpperCase() === 'VOYAGORA100') {
      setAppliedDiscount(100);
      alert('Promo code applied! ₹100 off');
    } else {
      setAppliedDiscount(0);
      alert('Invalid promo code.');
    }
  };

  const handlePay = async () => {
    if (tour && !travelDate) { alert('Please select a travel date'); return; }
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const res = await fetch('http://localhost:3000/bookings/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ 
        itemId: item.id, 
        itemType: tour ? 'tour' : 'event', 
        travelDate,
        couponCode: appliedDiscount > 0 ? promoCode.toUpperCase() : undefined
      })
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; } 
    else { alert(data.message || 'Failed to initiate payment'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-6 text-white">
          <h2 className="text-2xl font-bold">Secure Checkout</h2>
          <p className="text-slate-400 text-sm">Powered by Stripe</p>
        </div>
        
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <img src={item.imageUrl} alt="" className="w-24 h-24 object-cover rounded-xl" />
            <div>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-2">{item.description}</p>
            </div>
          </div>

          {tour && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Travel Date</label>
              <input type="date" required value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
            </div>
          )}

          {/* PROMO CODE SECTION */}
          <form onSubmit={handleApplyPromo} className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Promo Code (try VOYAGORA100)" 
              value={promoCode} 
              onChange={(e) => setPromoCode(e.target.value)} 
              className="flex-grow p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm uppercase"
            />
            <button type="submit" className="bg-slate-200 text-slate-800 px-4 rounded-xl text-sm font-semibold hover:bg-slate-300">Apply</button>
          </form>

          <div className="border-t border-slate-200 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Base Price</span><span>₹{basePrice}</span></div>
            {item.gstPercentage > 0 && <div className="flex justify-between text-slate-500"><span>GST ({item.gstPercentage}%)</span><span>₹{gst}</span></div>}
            {appliedDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- ₹{appliedDiscount}</span></div>}
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-2">
              <span>{isAdvance ? 'Advance Payable Now' : 'Total Payable Now'}</span><span>₹{amountPayableNow}</span>
            </div>
            {isAdvance && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                ⚠️ <b>Pending Amount: ₹{pendingAmount}</b><br/>This remaining amount must be paid directly to the organizer upon arrival.
              </div>
            )}
          </div>

          <button onClick={handlePay} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Redirecting to Stripe...' : 'Pay ₹' + amountPayableNow + ' Now'}
          </button>
          <button onClick={() => navigate(-1)} className="w-full text-center text-slate-500 mt-4 text-sm hover:text-slate-900">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
`);

console.log('\n✨ Step 30 (Promo Codes & Discounts) successfully generated!');
