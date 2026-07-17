const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add GST & Advance Payment fields)
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
  paymentType     String   @default("FULL") // FULL or ADVANCE
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
  totalAmount     Float    // Total cost of the tour
  amountPaid      Float    // Amount actually paid online
  pendingAmount   Float    // Amount to pay organizer on arrival
  platformFee     Float
  organizerPayout Float
  gstAmount       Float
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
`);

// 2. UPDATE TOUR & EVENT SERVICES (Accept new fields)
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
        price: Number(dto.price),
        imageUrl: dto.imageUrl,
        lat: dto.lat || 0,
        lng: dto.lng || 0,
        organizerId,
        paymentType: dto.paymentType || 'FULL',
        advanceAmount: Number(dto.advanceAmount) || 0,
        gstNumber: dto.gstNumber || null,
        gstPercentage: Number(dto.gstPercentage) || 0,
      },
    });
  }

  async getAllTours() {
    const tours = await this.prisma.tour.findMany({
      include: { organizer: { select: { name: true } }, reviews: true },
      orderBy: { createdAt: 'desc' },
    });
    return tours.map(t => {
      const avgRating = t.reviews.length > 0 ? t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length : 0;
      return { ...t, avgRating: avgRating.toFixed(1), reviewCount: t.reviews.length };
    });
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
    return { totalRevenue, totalBookings: bookings.length, activeTours: tours.length, upcomingEvents: events.length };
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
        title: dto.title,
        description: dto.description,
        price: Number(dto.price),
        imageUrl: dto.imageUrl,
        lat: dto.lat || 0,
        lng: dto.lng || 0,
        eventDate: new Date(dto.eventDate),
        organizerId,
        paymentType: dto.paymentType || 'FULL',
        advanceAmount: Number(dto.advanceAmount) || 0,
        gstNumber: dto.gstNumber || null,
        gstPercentage: Number(dto.gstPercentage) || 0,
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

// 3. UPDATE BOOKING SERVICE (Calculate GST, Advance, Pending Amount)
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

    // Calculate Pricing
    const basePrice = item.price;
    const gstAmount = (basePrice * (item.gstPercentage || 0)) / 100;
    
    let amountToPayOnline = basePrice + gstAmount; // Default to FULL
    if (item.paymentType === 'ADVANCE') {
      amountToPayOnline = (item.advanceAmount || 0) + gstAmount; // Pay advance + GST online
    }
    const pendingAmount = (basePrice + gstAmount) - amountToPayOnline;

    const platformFee = amountToPayOnline * 0.05; // 5% platform fee on the amount paid online
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
        userId, 
        itemId, 
        itemType, 
        travelDate: travelDate || '',
        totalAmount: basePrice.toString(),
        amountPaid: amountToPayOnline.toString(),
        pendingAmount: pendingAmount.toString(),
        platformFee: platformFee.toString(),
        organizerPayout: organizerPayout.toString(),
        gstAmount: gstAmount.toString()
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

// 4. UPDATE ORGANIZER DASHBOARD (Add GST & Advance Form Fields)
createFile('apps/web/src/pages/Dashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MapPicker from '../components/MapPicker';
import ImageUpload from '../components/ImageUpload';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tours, setTours] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, activeTours: 0, upcomingEvents: 0 });
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('TOUR');
  const [formData, setFormData] = useState({ 
    title: '', description: '', price: 0, imageUrl: '', lat: 0, lng: 0, eventDate: '',
    paymentType: 'FULL', advanceAmount: 0, gstNumber: '', gstPercentage: 0
  });

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const tRes = await fetch('http://localhost:3000/tours'); setTours(await tRes.json());
    const eRes = await fetch('http://localhost:3000/events'); setEvents(await eRes.json());
    const sRes = await fetch('http://localhost:3000/tours/stats', { headers: { 'Authorization': 'Bearer ' + token } });
    setStats(await sRes.json());
  };
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const endpoint = type === 'TOUR' ? 'tours' : 'events';
    await fetch('http://localhost:3000/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(formData)
    });
    setShowForm(false);
    setFormData({ title: '', description: '', price: 0, imageUrl: '', lat: 0, lng: 0, eventDate: '', paymentType: 'FULL', advanceAmount: 0, gstNumber: '', gstPercentage: 0 });
    fetchData();
  };

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-indigo-400 font-semibold flex items-center gap-2">📊 Overview</button>
          <button onClick={() => navigate('/scanner')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">📷 Scanner</button>
        </nav>
        <button onClick={logout} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      <main className="flex-grow p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Welcome back, Organizer</h2>
            <p className="text-slate-500">Here's what's happening with your business today.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500">+ Create New</button>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Revenue</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{stats.totalRevenue.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Bookings</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalBookings}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Active Tours</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.activeTours}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Upcoming Events</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.upcomingEvents}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Inventory Management</h3></div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr><th className="p-4 font-medium">Listing</th><th className="p-4 font-medium">Type</th><th className="p-4 font-medium">Price</th><th className="p-4 font-medium">Payment</th></tr>
            </thead>
            <tbody>
              {tours.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={t.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{t.title}</span></td>
                  <td className="p-4"><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">Tour</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{t.price}</td>
                  <td className="p-4 text-slate-600 text-sm">{t.paymentType === 'ADVANCE' ? 'Advance: ₹'+t.advanceAmount : 'Full'}</td>
                </tr>
              ))}
              {events.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={e.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{e.title}</span></td>
                  <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">Event</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{e.price}</td>
                  <td className="p-4 text-slate-600 text-sm">{e.paymentType === 'ADVANCE' ? 'Advance: ₹'+e.advanceAmount : 'Full'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tours.length === 0 && events.length === 0 && <p className="p-8 text-center text-slate-400">No listings yet. Click "Create New" to start.</p>}
        </div>
      </main>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Listing</h2>
              <div className="flex gap-4 mb-6 bg-slate-100 p-2 rounded-xl">
                <button onClick={() => setType('TOUR')} className={"flex-1 py-2 rounded-lg font-semibold " + (type === 'TOUR' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Tour</button>
                <button onClick={() => setType('EVENT')} className={"flex-1 py-2 rounded-lg font-semibold " + (type === 'EVENT' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Event</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <input type="text" required placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
                <textarea required placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none h-24 text-slate-800" />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input type="number" required placeholder="Total Price" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" />
                  </div>
                  <input type="number" placeholder="GST %" value={formData.gstPercentage || ''} onChange={(e) => setFormData({ ...formData, gstPercentage: Number(e.target.value) })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
                </div>
                <input type="text" placeholder="GST Number (Optional)" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />

                {type === 'EVENT' && <input type="datetime-local" required value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />}
                
                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Options</label>
                  <div className="flex gap-4 mb-4">
                    <button type="button" onClick={() => setFormData({ ...formData, paymentType: 'FULL' })} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (formData.paymentType === 'FULL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>Full Payment</button>
                    <button type="button" onClick={() => setFormData({ ...formData, paymentType: 'ADVANCE' })} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (formData.paymentType === 'ADVANCE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>Advance Only</button>
                  </div>
                  {formData.paymentType === 'ADVANCE' && (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                      <input type="number" required placeholder="Advance Amount to pay online" value={formData.advanceAmount || ''} onChange={(e) => setFormData({ ...formData, advanceAmount: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Image</label>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />}
                  <ImageUpload onUpload={(url) => setFormData({ ...formData, imageUrl: url })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Location on Map</label>
                  <MapPicker lat={formData.lat} lng={formData.lng} setPos={(lat, lng) => setFormData({ ...formData, lat, lng })} />
                </div>
                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300">← Back to Dashboard</button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500">Save Listing</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
`);

// 5. UPDATE CHECKOUT PAGE (Show Advance/Full Breakdown)
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

  const isAdvance = item.paymentType === 'ADVANCE';
  const basePrice = item.price;
  const gst = (basePrice * (item.gstPercentage || 0)) / 100;
  const amountPayableNow = isAdvance ? (item.advanceAmount + gst) : (basePrice + gst);
  const pendingAmount = isAdvance ? (basePrice + gst) - amountPayableNow : 0;

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

          {tour && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Travel Date</label>
              <input type="date" required value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
            </div>
          )}

          {event && (
            <div className="mb-6 bg-slate-100 p-3 rounded-xl text-sm text-slate-700">
              <b>Event Date:</b> {new Date(event.eventDate).toLocaleString()}
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Base Price</span><span>₹{basePrice}</span></div>
            {item.gstPercentage > 0 && <div className="flex justify-between text-slate-500"><span>GST ({item.gstPercentage}%)</span><span>₹{gst}</span></div>}
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-2">
              <span>{isAdvance ? 'Advance Payable Now' : 'Total Payable Now'}</span><span>₹{amountPayableNow}</span>
            </div>
            {isAdvance && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                ⚠️ <b>Pending Amount: ₹{pendingAmount}</b><br/>This remaining amount must be paid directly to the organizer in cash or via their preferred method upon arrival.
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

console.log('\n✨ Step 26 (GST & Advance Payments) successfully generated!');
