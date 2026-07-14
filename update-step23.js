const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Review Model)
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
  reviews     Review[]
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
  reviews     Review[]
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
`);

// 2. CREATE REVIEW SERVICE & CONTROLLER
createFile('apps/api/src/review.service.ts', `
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  async createReview(userId: string, dto: { rating: number; comment: string; tourId?: string; eventId?: string }) {
    return this.prisma.review.create({
      data: { ...dto, userId },
    });
  }

  async getReviewsForItem(itemId: string, itemType: string) {
    return this.prisma.review.findMany({
      where: { [itemType + 'Id']: itemId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
`);

createFile('apps/api/src/review.controller.ts', `
import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ReviewService } from './review.service';
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

@Controller('reviews')
export class ReviewController {
  constructor(private readonly rs: ReviewService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    return this.rs.createReview(req.user.sub, body);
  }

  @Get()
  async getReviews(@Query('itemId') itemId: string, @Query('itemType') itemType: string) {
    return this.rs.getReviewsForItem(itemId, itemType);
  }
}
`);

// 3. UPDATE TOUR SERVICE (Add Organizer Stats Endpoint)
createFile('apps/api/src/tour.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}

  async createTour(organizerId: string, dto: any) {
    return this.prisma.tour.create({
      data: { title: dto.title, description: dto.description, price: dto.price, imageUrl: dto.imageUrl, lat: dto.lat || 0, lng: dto.lng || 0, organizerId },
    });
  }

  async getAllTours() {
    const tours = await this.prisma.tour.findMany({
      include: { organizer: { select: { name: true } }, reviews: true },
      orderBy: { createdAt: 'desc' },
    });
    // Calculate average rating
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
    
    return {
      totalRevenue,
      totalBookings: bookings.length,
      activeTours: tours.length,
      upcomingEvents: events.length,
    };
  }
}
`);

// 4. UPDATE TOUR CONTROLLER (Add Stats Route)
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

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.tourService.getOrganizerStats(req.user.sub);
  }
}
`);

// 5. UPDATE APP MODULE (Wire up Reviews)
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
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService],
})
export class AppModule {}
`);

// 6. UPGRADE ORGANIZER DASHBOARD (Real Analytics)
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
  const [formData, setFormData] = useState({ title: '', description: '', price: 0, imageUrl: '', lat: 0, lng: 0, eventDate: '' });

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
    setFormData({ title: '', description: '', price: 0, imageUrl: '', lat: 0, lng: 0, eventDate: '' });
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
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 flex items-center gap-2">+ Create New</button>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Revenue</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{stats.totalRevenue.toLocaleString()}</h3>
            <p className="text-green-500 text-xs mt-2">+0% from last month</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Bookings</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalBookings}</h3>
            <p className="text-slate-400 text-xs mt-2">Lifetime bookings</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Active Tours</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.activeTours}</h3>
            <p className="text-slate-400 text-xs mt-2">{tours.length} live listings</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Upcoming Events</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.upcomingEvents}</h3>
            <p className="text-slate-400 text-xs mt-2">{events.length} scheduled</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Inventory Management</h3></div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr><th className="p-4 font-medium">Listing</th><th className="p-4 font-medium">Type</th><th className="p-4 font-medium">Price</th></tr>
            </thead>
            <tbody>
              {tours.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={t.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{t.title}</span></td>
                  <td className="p-4"><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">Tour</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{t.price}</td>
                </tr>
              ))}
              {events.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={e.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{e.title}</span></td>
                  <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">Event</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{e.price}</td>
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
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input type="number" required placeholder="0.00" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" />
                </div>
                {type === 'EVENT' && <input type="datetime-local" required value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />}
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

console.log('\n✨ Step 23 (Real Analytics & Reviews) successfully generated!');
