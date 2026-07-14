const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Travel Date to Booking)
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
  tours              Tour[]
  events             Event[]
  bookings           Booking[]
  places             CommunityPlace[]
  createdAt          DateTime @default(now())
}
model Tour {
  id          String   @id @default(uuid())
  title       String
  description String
  price       Float
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  organizerId String
  organizer   User     @relation(fields: [organizerId], references: [id])
  bookings    Booking[]
  createdAt   DateTime @default(now())
}
model Event {
  id          String   @id @default(uuid())
  title       String
  description String
  price       Float
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  eventDate   DateTime
  organizerId String
  organizer   User     @relation(fields: [organizerId], references: [id])
  bookings    Booking[]
  createdAt   DateTime @default(now())
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
  platformFee     Float
  organizerPayout Float
  status          String   @default("CONFIRMED")
  qrCode          String   @unique
  isCheckedIn     Boolean  @default(false)
  travelDate      DateTime? // NEW: For tours where user selects date
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
`);

// 2. FIX BACKEND TOUR CONTROLLER (Fix crash on create)
createFile('apps/api/src/tour.controller.ts', `
import { Controller, Post, Get, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { TourService } from './tour.service';
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

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService, private jwtService: JwtService) {}

  @Get()
  async getAllTours() { return this.tourService.getAllTours(); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async createTour(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create tours');
    return this.tourService.createTour(req.user.sub, body);
  }
}
`);

// 3. FIX BACKEND EVENT CONTROLLER (Fix crash on create)
createFile('apps/api/src/event.controller.ts', `
import { Controller, Post, Get, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EventService } from './event.service';
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

@Controller('events')
export class EventController {
  constructor(private readonly es: EventService, private jwtService: JwtService) {}

  @Get() async getAll() { return this.es.getAllEvents(); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create events');
    return this.es.createEvent(req.user.sub, body);
  }
}
`);

// 4. UPDATE BOOKING CONTROLLER & SERVICE (Accept travelDate)
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
  async createCheckout(@Request() req: any, @Body() body: { itemId: string, itemType: string, travelDate?: string }) {
    return this.bookingService.createCheckoutSession(req.user.sub, body.itemId, body.itemType, body.travelDate);
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

  async createCheckoutSession(userId: string, itemId: string, itemType: string, travelDate?: string) {
    const item = await (this.prisma as any)[itemType].findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: item.title, description: item.description.substring(0, 100) },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: 1,
      }],
      metadata: { userId, itemId, itemType, travelDate: travelDate || '' },
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

    const { userId, itemId, itemType, travelDate } = session.metadata!;
    const item = await (this.prisma as any)[itemType].findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const platformFee = item.price * 0.05;
    const organizerPayout = item.price - platformFee;
    const qrCode = 'VOY-' + sessionId.slice(-12);

    return this.prisma.booking.create({
      data: {
        userId,
        [itemType + 'Id']: itemId,
        totalAmount: item.price,
        platformFee,
        organizerPayout,
        status: 'CONFIRMED',
        qrCode,
        travelDate: travelDate ? new Date(travelDate) : null,
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

// 5. UPGRADE CHECKOUT PAGE (Add Calendar Date Picker)
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

  if (!item) { navigate('/'); return null; }

  const handlePay = async () => {
    if (tour && !travelDate) { alert('Please select a travel date'); return; }
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const res = await fetch('http://localhost:3000/bookings/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ itemId: item.id, itemType: tour ? 'tour' : 'event', travelDate })
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; } 
    else { alert('Failed to initiate payment'); setLoading(false); }
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

          {/* Dynamic Calendar Button for Tours */}
          {tour && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Travel Date</label>
              <input 
                type="date" 
                required 
                value={travelDate} 
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
          )}

          {event && (
            <div className="mb-6 bg-slate-100 p-3 rounded-xl text-sm text-slate-700">
              <b>Event Date:</b> {new Date(event.eventDate).toLocaleString()}
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Base Price</span><span>₹{item.price}</span></div>
            <div className="flex justify-between text-slate-500"><span>Platform Fee (5%)</span><span>₹{item.price * 0.05}</span></div>
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-2"><span>Total</span><span>₹{item.price}</span></div>
          </div>

          <button onClick={handlePay} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Redirecting to Stripe...' : 'Pay ₹' + item.price + ' Now'}
          </button>
          <button onClick={() => navigate(-1)} className="w-full text-center text-slate-500 mt-4 text-sm hover:text-slate-900">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
`);

// 6. UPGRADE TRAVELER DASHBOARD (Premium UI with Sidebar & Cards)
createFile('apps/web/src/pages/TravelerDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function TravelerDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'TRAVELER') return navigate('/');
    
    fetch('http://localhost:3000/bookings/mine', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(res => res.json()).then(data => { setBookings(data); setLoading(false); });
  }, [navigate]);

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-indigo-400 font-semibold flex items-center gap-2">✈️ My Trips</button>
          <button onClick={() => navigate('/hidden-gems')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">💎 Hidden Gems</button>
          <button onClick={() => navigate('/')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">🏠 Explore</button>
        </nav>
        <button onClick={logout} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800">My Trips</h2>
          <p className="text-slate-500">Manage your upcoming adventures and past journeys.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading your trips...</div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">🧳</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No trips booked yet</h3>
            <p className="text-slate-500 mb-6">Time to pack your bags and explore the world!</p>
            <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">Explore Tours</button>
          </div>
        ) : (
          <div className="grid gap-6">
            {bookings.map((b, i) => {
              const item = b.tour || b.event;
              const isTour = !!b.tour;
              const tripDate = isTour ? b.travelDate : b.event?.eventDate;
              
              return (
                <motion.div 
                  key={b.id} 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-shadow"
                >
                  <img src={item.imageUrl} alt={item.title} className="w-full md:w-48 h-48 object-cover" />
                  
                  <div className="p-6 flex-grow flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={isTour ? "bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold" : "bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold"}>
                          {isTour ? 'Tour' : 'Event'}
                        </span>
                        <span className={b.isCheckedIn ? "bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold" : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold"}>
                          {b.isCheckedIn ? 'Checked In' : 'Valid'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{item.title}</h3>
                      <p className="text-slate-500 text-sm mb-4">
                        {tripDate ? new Date(tripDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not specified'}
                      </p>
                      <div className="flex gap-4 text-sm text-slate-400">
                        <span>🎟️ Ticket ID: {b.id.slice(0, 8).toUpperCase()}</span>
                        <span>💰 Paid: ₹{b.totalAmount}</span>
                      </div>
                    </div>
                    
                    <div className="flex md:flex-col gap-2 md:items-end justify-between">
                      <button onClick={() => navigate('/my-bookings')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 w-full md:w-auto">
                        View Ticket
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
`);

console.log('\n✨ Step 21 (Save Fix, Calendar, Premium Traveler UI) successfully generated!');
