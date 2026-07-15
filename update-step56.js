const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE TOUR SERVICE (Add Delete Logic)
createFile('apps/api/src/tour.service.ts', `
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}

  async createTour(organizerId: string, dto: any) {
    return this.prisma.tour.create({
      data: { title: dto.title, description: dto.description, price: Number(dto.price), imageUrl: dto.imageUrl, gallery: dto.gallery || [], lat: dto.lat || 0, lng: dto.lng || 0, organizerId, paymentType: dto.paymentType || 'FULL', advanceAmount: Number(dto.advanceAmount) || 0, gstNumber: dto.gstNumber || null, gstPercentage: Number(dto.gstPercentage) || 0 },
    });
  }

  async getAllTours(query: { search?: string; maxPrice?: string }) {
    const where: any = {};
    if (query.search) { where.OR = [{ title: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }]; }
    if (query.maxPrice) { where.price = { lte: Number(query.maxPrice) }; }
    const tours = await this.prisma.tour.findMany({ where, include: { organizer: { select: { name: true, profileImageUrl: true } }, reviews: true }, orderBy: { createdAt: 'desc' } });
    return tours.map(t => { const avgRating = t.reviews.length > 0 ? t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length : 0; return { ...t, avgRating: avgRating.toFixed(1), reviewCount: t.reviews.length }; });
  }

  async getTourById(id: string) {
    const tour = await this.prisma.tour.findUnique({ where: { id }, include: { organizer: { select: { name: true, profileImageUrl: true, bio: true } }, reviews: { include: { user: { select: { name: true, profileImageUrl: true } } }, orderBy: { createdAt: 'desc' } } } });
    if (!tour) throw new NotFoundException('Tour not found');
    const avgRating = tour.reviews.length > 0 ? tour.reviews.reduce((acc, r) => acc + r.rating, 0) / tour.reviews.length : 0;
    return { ...tour, avgRating: avgRating.toFixed(1), reviewCount: tour.reviews.length };
  }

  async deleteTour(id: string, organizerId: string) {
    const tour = await this.prisma.tour.findUnique({ where: { id } });
    if (!tour) throw new NotFoundException('Tour not found');
    if (tour.organizerId !== organizerId) throw new ForbiddenException('You do not own this tour');
    return this.prisma.tour.delete({ where: { id } });
  }

  async getOrganizerStats(organizerId: string) {
    const tours = await this.prisma.tour.findMany({ where: { organizerId }, select: { id: true } });
    const events = await this.prisma.event.findMany({ where: { organizerId }, select: { id: true } });
    const tourIds = tours.map(t => t.id); const eventIds = events.map(e => e.id);
    const bookings = await this.prisma.booking.findMany({ where: { OR: [{ tourId: { in: tourIds } }, { eventId: { in: eventIds } }] } });
    const totalRevenue = bookings.reduce((acc, b) => acc + b.organizerPayout, 0);
    const chartData = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dateString = d.toISOString().split('T')[0]; const dayBookings = bookings.filter(b => new Date(b.createdAt).toISOString().split('T')[0] === dateString); chartData.push({ date: d.toLocaleDateString('en-US', { weekday: 'short' }), revenue: dayBookings.reduce((acc, b) => acc + b.organizerPayout, 0), bookings: dayBookings.length }); }
    return { totalRevenue, totalBookings: bookings.length, activeTours: tours.length, upcomingEvents: events.length, chartData };
  }
}
`);

// 2. UPDATE TOUR CONTROLLER (Add Delete Route)
createFile('apps/api/src/tour.controller.ts', `
import { Controller, Post, Get, Delete, Param, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { TourService } from './tour.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService, private jwtService: JwtService) {}

  @Get() async getAllTours(@Query() query: { search?: string; maxPrice?: string }) { return this.tourService.getAllTours(query); }
  @Get(':id') async getTourById(@Param('id') id: string) { return this.tourService.getTourById(id); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post() async createTour(@Request() req: any, @Body() body: any) { if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create tours'); return this.tourService.createTour(req.user.sub, body); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Delete(':id') async deleteTour(@Request() req: any, @Param('id') id: string) { return this.tourService.deleteTour(id, req.user.sub); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Get('stats') async getStats(@Request() req: any) { return this.tourService.getOrganizerStats(req.user.sub); }
}
`);

// 3. UPDATE EVENT SERVICE & CONTROLLER (Add Delete Logic)
createFile('apps/api/src/event.service.ts', `
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}
  async createEvent(organizerId: string, dto: any) { return this.prisma.event.create({ data: { title: dto.title, description: dto.description, price: Number(dto.price), imageUrl: dto.imageUrl, gallery: dto.gallery || [], lat: dto.lat || 0, lng: dto.lng || 0, eventDate: new Date(dto.eventDate), organizerId, paymentType: dto.paymentType || 'FULL', advanceAmount: Number(dto.advanceAmount) || 0, gstNumber: dto.gstNumber || null, gstPercentage: Number(dto.gstPercentage) || 0 } }); }
  async getAllEvents() { return this.prisma.event.findMany({ include: { organizer: { select: { name: true } } }, orderBy: { eventDate: 'asc' } }); }
  async deleteEvent(id: string, organizerId: string) { const event = await this.prisma.event.findUnique({ where: { id } }); if (!event) throw new NotFoundException('Event not found'); if (event.organizerId !== organizerId) throw new ForbiddenException('You do not own this event'); return this.prisma.event.delete({ where: { id } }); }
}
`);

createFile('apps/api/src/event.controller.ts', `
import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }

@Controller('events')
export class EventController {
  constructor(private readonly es: EventService, private jwtService: JwtService) {}
  @Get() async getAll() { return this.es.getAllEvents(); }
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post() async create(@Request() req: any, @Body() body: any) { if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create events'); return this.es.createEvent(req.user.sub, body); }
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Delete(':id') async delete(@Request() req: any, @Param('id') id: string) { return this.es.deleteEvent(id, req.user.sub); }
}
`);

// 4. CREATE NEW EXPLORE PAGE (With Filters)
createFile('apps/web/src/pages/Explore.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Explore() {
  const { type } = useParams(); // 'tours', 'events', 'gems'
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const titles: any = { tours: 'Travel Packages', events: 'Upcoming Events', gems: 'Hidden Gems' };

  useEffect(() => {
    setLoading(true);
    let url = 'http://localhost:3000/' + (type === 'gems' ? 'community' : type);
    if (type === 'tours' && (searchQuery || maxPrice)) {
      url += '?';
      if (searchQuery) url += 'search=' + encodeURIComponent(searchQuery) + '&';
      if (maxPrice) url += 'maxPrice=' + maxPrice;
    }
    fetch(url).then(res => res.json()).then(data => {
      let filtered = data;
      if (type === 'events' && dateFilter) filtered = data.filter((e: any) => new Date(e.eventDate).toISOString().split('T')[0] === dateFilter);
      if (type === 'gems' && searchQuery) filtered = data.filter((g: any) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
      setItems(filtered);
      setLoading(false);
    });
  }, [type, searchQuery, maxPrice, dateFilter]);

  const handleBookNow = (item: any) => {
    if (type === 'tours') navigate('/tours/' + item.id);
    else if (type === 'events') navigate('/checkout', { state: { event: item } });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white py-16 px-8">
        <div className="max-w-7xl mx-auto">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white mb-4 flex items-center gap-2">← Back to Home</button>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-2">{titles[type]}</h1>
          <p className="text-slate-400">Find your next adventure. Filter by location, price, or date.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-wrap gap-4 items-center">
          {(type === 'tours' || type === 'gems') && (
            <input type="text" placeholder="Search by name or place..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-grow p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm min-w-[200px]" />
          )}
          {type === 'tours' && (
            <input type="number" placeholder="Max Price (₹)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-40 p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm" />
          )}
          {type === 'events' && (
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm" />
          )}
        </div>

        {loading ? <div className="text-center py-12 text-slate-500">Loading...</div> : (
          items.length === 0 ? <div className="text-center py-12 text-slate-500">No items found matching your filters.</div> : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col hover:shadow-lg transition">
                  <img src={item.imageUrl} alt={item.title || item.name} className="w-full h-48 object-cover" />
                  <div className="p-5 flex-grow flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title || item.name}</h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-grow">{item.description}</p>
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                      <span className="font-bold text-slate-900">{item.price ? '₹' + item.price : (item.eventDate ? new Date(item.eventDate).toLocaleDateString() : 'Community Gem')}</span>
                      {(type === 'tours' || type === 'events') && <button onClick={() => handleBookNow(item)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-600">Book Now</button>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
`);

console.log('\n✨ Step 56 (Backend Delete & Explore Page) successfully generated!');
