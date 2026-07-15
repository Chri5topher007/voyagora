const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE SEED.JS (Only 1 item each)
createFile('apps/api/seed.js', `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@voyagora.com' },
    update: {},
    create: {
      email: 'organizer@voyagora.com',
      password: '$2a$10$K7L1OJ45/4Y2nIvhVp9c4uX1ZxZ8o7w9q3zYxW0v1u2t3s4r5p6o7i',
      name: 'Voyagora Official',
      role: 'ORGANIZER',
      subscriptionStatus: 'ACTIVE',
      bio: 'Premium travel experiences curated by the Voyagora team.',
      profileImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80'
    },
  });

  const traveler = await prisma.user.upsert({
    where: { email: 'traveler@voyagora.com' },
    update: {},
    create: {
      email: 'traveler@voyagora.com',
      password: '$2a$10$K7L1OJ45/4Y2nIvhVp9c4uX1ZxZ8o7w9q3zYxW0v1u2t3s4r5p6o7i',
      name: 'Alex Wanderlust',
      role: 'TRAVELER',
      bio: 'Exploring the unseen.',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
    },
  });

  // 1 Tour
  await prisma.tour.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Magical Maldives Getaway',
        description: 'Spend 5 days in an overwater bungalow. Includes scuba diving, snorkeling, and private beach dinners. Flights not included.',
        price: 45000,
        imageUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80',
        gallery: ["https://images.unsplash.com/photo-1573843981267-be1999ff37cd?auto=format&fit=crop&w=800&q=80"],
        lat: 3.2028, lng: 73.2207,
        organizerId: organizer.id,
        paymentType: 'ADVANCE', advanceAmount: 10000, gstPercentage: 5
      }
    ]
  });

  // 1 Event
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 14);

  await prisma.event.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Goa Sunburn Beach Festival',
        description: 'The biggest electronic music festival in India. 3 days of non-stop music, beach parties, and international DJs.',
        price: 5000,
        imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=80',
        gallery: [],
        lat: 15.2993, lng: 74.1240,
        eventDate: futureDate1,
        organizerId: organizer.id,
        paymentType: 'FULL', gstPercentage: 18
      }
    ]
  });

  // 1 Gem
  await prisma.communityPlace.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Secret Waterfall, Wayanad',
        description: 'A hidden gem deep inside the forest. Requires a 2km trek, but the view is absolutely worth it. Best visited just after monsoon.',
        imageUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
        lat: 11.6854, lng: 76.1320,
        status: 'APPROVED',
        uploadedBy: traveler.id
      }
    ]
  });

  console.log('✅ Dummy data seeded successfully (1 of each)!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
`);

// 2. UPDATE EVENT SERVICE (Add getEventById)
createFile('apps/api/src/event.service.ts', `
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}
  async createEvent(organizerId: string, dto: any) { return this.prisma.event.create({ data: { title: dto.title, description: dto.description, price: Number(dto.price), imageUrl: dto.imageUrl, gallery: dto.gallery || [], lat: dto.lat || 0, lng: dto.lng || 0, eventDate: new Date(dto.eventDate), organizerId, paymentType: dto.paymentType || 'FULL', advanceAmount: Number(dto.advanceAmount) || 0, gstNumber: dto.gstNumber || null, gstPercentage: Number(dto.gstPercentage) || 0 } }); }
  
  async getAllEvents() { return this.prisma.event.findMany({ include: { organizer: { select: { name: true } } }, orderBy: { eventDate: 'asc' } }); }

  async getEventById(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: { organizer: { select: { name: true, profileImageUrl: true, bio: true } }, reviews: { include: { user: { select: { name: true, profileImageUrl: true } } }, orderBy: { createdAt: 'desc' } } } });
    if (!event) throw new NotFoundException('Event not found');
    const avgRating = event.reviews.length > 0 ? event.reviews.reduce((acc, r) => acc + r.rating, 0) / event.reviews.length : 0;
    return { ...event, avgRating: avgRating.toFixed(1), reviewCount: event.reviews.length };
  }

  async deleteEvent(id: string, organizerId: string) { const event = await this.prisma.event.findUnique({ where: { id } }); if (!event) throw new NotFoundException('Event not found'); if (event.organizerId !== organizerId) throw new ForbiddenException('You do not own this event'); return this.prisma.event.delete({ where: { id } }); }
}
`);

// 3. UPDATE EVENT CONTROLLER (Add getEventById Route)
createFile('apps/api/src/event.controller.ts', `
import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }

@Controller('events')
export class EventController {
  constructor(private readonly es: EventService, private jwtService: JwtService) {}
  @Get() async getAll() { return this.es.getAllEvents(); }
  @Get(':id') async getEventById(@Param('id') id: string) { return this.es.getEventById(id); }
  
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post() async create(@Request() req: any, @Body() body: any) { if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create events'); return this.es.createEvent(req.user.sub, body); }
  
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Delete(':id') async delete(@Request() req: any, @Param('id') id: string) { return this.es.deleteEvent(id, req.user.sub); }
}
`);

// 4. UPDATE EXPLORE PAGE (Navigate to detail pages without login)
createFile('apps/web/src/pages/Explore.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Explore() {
  const params = useParams();
  const type = params.type || 'tours';
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

  const handleCardClick = (item: any) => {
    if (type === 'tours') navigate('/tours/' + item.id);
    else if (type === 'events') navigate('/events/' + item.id);
    else if (type === 'gems') navigate('/gems/' + item.id);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white py-16 px-8">
        <div className="max-w-7xl mx-auto">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white mb-4 flex items-center gap-2">← Back to Home</button>
          <h1 className="text-4xl md:text-5xl font-serif font-extrabold mb-2">{titles[type]}</h1>
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
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => handleCardClick(item)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col hover:shadow-lg transition cursor-pointer">
                  <img src={item.imageUrl} alt={item.title || item.name} className="w-full h-48 object-cover" />
                  <div className="p-5 flex-grow flex flex-col">
                    <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">{item.title || item.name}</h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-grow">{item.description}</p>
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                      <span className="font-bold text-slate-900">{item.price ? '₹' + item.price : (item.eventDate ? new Date(item.eventDate).toLocaleDateString() : 'Community Gem')}</span>
                      <span className="text-indigo-600 text-sm font-semibold">View Details →</span>
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

// 5. CREATE EVENT DETAIL PAGE (Allows viewing without login, prompts login only on Book Now)
createFile('apps/web/src/pages/EventDetail.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WishlistButton from '../components/WishlistButton';
import FollowButton from '../components/FollowButton';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/events/' + id)
      .then(res => res.json())
      .then(data => { setEvent(data); setLoading(false); })
      .catch(() => { alert('Event not found'); navigate('/'); });
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading event...</div>;
  if (!event) return null;

  const handleBookNow = () => {
    if (!localStorage.getItem('token')) return navigate('/login');
    navigate('/checkout', { state: { event } });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        
        <button onClick={() => navigate('/explore/events')} className="absolute top-6 left-6 bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition flex items-center gap-2">
          ← Back to Events
        </button>
        <div className="absolute top-6 right-6">
          <WishlistButton itemId={event.id} itemType="event" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-purple-600 px-3 py-1 rounded-full text-xs font-bold">Event</span>
            <span className="text-sm font-medium bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">⭐ {event.avgRating} ({event.reviewCount} reviews)</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-extrabold tracking-tight">{event.title}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <img src={event.organizer.profileImageUrl || 'https://via.placeholder.com/60'} alt="" className="w-16 h-16 rounded-full object-cover" />
            <div className="flex-grow">
              <p className="text-sm text-slate-500">Organized by</p>
              <h3 className="text-xl font-bold text-slate-900">{event.organizer.name}</h3>
              {event.organizer.bio && <p className="text-sm text-slate-500 line-clamp-1">{event.organizer.bio}</p>}
            </div>
            <FollowButton organizerId={event.organizerId} />
          </div>

          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">About this event</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{event.description}</p>
          </div>

          {event.lat !== 0 && event.lng !== 0 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">Event Location</h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200 z-0">
                <MapContainer center={[event.lat, event.lng]} zoom={13} style={{ height: '300px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[event.lat, event.lng]} />
                </MapContainer>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 sticky top-8">
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-slate-900">₹{event.price}</span>
              {event.paymentType === 'ADVANCE' && <span className="text-sm text-slate-500">(Advance: ₹{event.advanceAmount})</span>}
            </div>
            
            <div className="space-y-3 mb-6 text-sm border-t border-b border-slate-100 py-4">
              <div className="flex justify-between"><span className="text-slate-500">Date & Time</span><span className="font-medium text-slate-900">{new Date(event.eventDate).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Type</span><span className="font-medium text-slate-900">{event.paymentType === 'ADVANCE' ? 'Advance Booking' : 'Full Payment'}</span></div>
              {event.gstPercentage > 0 && <div className="flex justify-between"><span className="text-slate-500">GST ({event.gstPercentage}%)</span><span className="font-medium text-slate-900">₹{(event.price * event.gstPercentage) / 100}</span></div>}
            </div>

            <button onClick={handleBookNow} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition mb-3">
              Book Now
            </button>
            <p className="text-xs text-slate-400 text-center">You won't be charged yet. Free cancellation up to 7 days before.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
`);

console.log('\n✨ Step 65 (1 Dummy Item, Event Details, No Auth Wall) successfully generated!');
