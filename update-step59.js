const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE COMMUNITY SERVICE (Add getPlaceById)
createFile('apps/api/src/community.service.ts', `
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {}

  async submitPlace(userId: string, dto: any) {
    return this.prisma.communityPlace.create({ data: { name: dto.name, description: dto.description, imageUrl: dto.imageUrl, lat: dto.lat || 0, lng: dto.lng || 0, uploadedBy: userId } });
  }

  async getApprovedPlaces() { return this.prisma.communityPlace.findMany({ where: { status: 'APPROVED' } }); }

  async getPlaceById(id: string) {
    const place = await this.prisma.communityPlace.findUnique({ where: { id }, include: { user: { select: { name: true, profileImageUrl: true } } } });
    if (!place) throw new NotFoundException('Gem not found');
    return place;
  }

  async getPendingPlaces() { return this.prisma.communityPlace.findMany({ where: { status: 'PENDING' }, include: { user: { select: { name: true } } } }); }

  async approvePlace(id: string) {
    const place = await this.prisma.communityPlace.update({ where: { id }, data: { status: 'APPROVED' } });
    await this.notificationService.sendNotification(place.uploadedBy, '✅ Your hidden gem "' + place.name + '" was approved and is now live!');
    return place;
  }
}
`);

// 2. UPDATE COMMUNITY CONTROLLER (Add getPlaceById Route)
createFile('apps/api/src/community.controller.ts', `
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }

@Controller('community')
export class CommunityController {
  constructor(private readonly cs: CommunityService, private jwtService: JwtService) {}

  @Get() async getApproved() { return this.cs.getApprovedPlaces(); }
  @Get(':id') async getPlaceById(@Param('id') id: string) { return this.cs.getPlaceById(id); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post() async submit(@Request() req: any, @Body() body: any) { return this.cs.submitPlace(req.user.sub, body); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Get('pending') async getPending(@Request() req: any) { if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only'); return this.cs.getPendingPlaces(); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Patch(':id/approve') async approve(@Request() req: any, @Param('id') id: string) { if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only'); return this.cs.approvePlace(id); }
}
`);

// 3. CREATE GEM DETAIL PAGE
createFile('apps/web/src/pages/GemDetail.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function GemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gem, setGem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/community/' + id)
      .then(res => res.json())
      .then(data => { setGem(data); setLoading(false); })
      .catch(() => { alert('Gem not found'); navigate('/'); });
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading gem...</div>;
  if (!gem) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={gem.imageUrl} alt={gem.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        
        <button onClick={() => navigate('/explore/gems')} className="absolute top-6 left-6 bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition flex items-center gap-2">
          ← Back to Gems
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-yellow-500 px-3 py-1 rounded-full text-xs font-bold">Hidden Gem</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{gem.name}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About this place</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{gem.description}</p>
          </div>

          {gem.lat !== 0 && gem.lng !== 0 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Map Location</h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200 z-0">
                <MapContainer center={[gem.lat, gem.lng]} zoom={13} style={{ height: '300px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[gem.lat, gem.lng]} />
                </MapContainer>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 sticky top-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Discovered By</h3>
            <div className="flex items-center gap-3">
              <img src={gem.user.profileImageUrl || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full object-cover" />
              <p className="font-bold text-slate-900">{gem.user.name}</p>
            </div>
            <button onClick={() => navigate('/explore/gems')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 mt-6">Explore More Gems</button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
`);

// 4. UPDATE EXPLORE PAGE (Make cards clickable to detail pages)
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
    else if (type === 'events') navigate('/checkout', { state: { event: item } });
    else if (type === 'gems') navigate('/gems/' + item.id);
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
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => handleCardClick(item)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col hover:shadow-lg transition cursor-pointer">
                  <img src={item.imageUrl} alt={item.title || item.name} className="w-full h-48 object-cover" />
                  <div className="p-5 flex-grow flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title || item.name}</h3>
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

// 5. UPDATE SEED.JS (Change Himalayan Image)
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
      },
      {
        title: 'Kerala Backwaters & Tea Gardens',
        description: 'A 4-day serene trip through Alleppey backwaters on a houseboat, followed by a visit to Munnar tea plantations. All meals included.',
        price: 25000,
        imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80',
        gallery: ["https://images.unsplash.com/photo-1573924072300-0218f3e4f7b8?auto=format&fit=crop&w=800&q=80"],
        lat: 9.9312, lng: 76.2673,
        organizerId: organizer.id,
        paymentType: 'FULL', gstPercentage: 0
      }
    ]
  });

  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 14);
  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 30);

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
      },
      {
        title: 'Himalayan Trekking Expedition',
        description: 'Join a 2-day guided trek to Kheerganga. Camping gear, meals, and professional guides included. Moderate difficulty.',
        price: 8000,
        imageUrl: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80',
        gallery: [],
        lat: 32.0397, lng: 77.4750,
        eventDate: futureDate2,
        organizerId: organizer.id,
        paymentType: 'ADVANCE', advanceAmount: 2000, gstPercentage: 0
      }
    ]
  });

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
      },
      {
        name: 'Hidden Beach Cave, Gokarna',
        description: 'Only accessible during low tide. A small cave that opens up to a private beach. Carry your own water and snacks.',
        imageUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80',
        lat: 14.5479, lng: 74.3188,
        status: 'APPROVED',
        uploadedBy: traveler.id
      }
    ]
  });

  console.log('✅ Dummy data seeded successfully!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
`);

console.log('\n✨ Step 59 (Gem Details, Clickable Cards, Himalayan Image) successfully generated!');
