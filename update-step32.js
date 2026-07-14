const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE TOUR SERVICE (Add getTourById)
createFile('apps/api/src/tour.service.ts', `
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}

  async createTour(organizerId: string, dto: any) {
    return this.prisma.tour.create({
      data: {
        title: dto.title, description: dto.description, price: Number(dto.price), imageUrl: dto.imageUrl,
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
    return { totalRevenue, totalBookings: bookings.length, activeTours: tours.length, upcomingEvents: events.length };
  }
}
`);

// 2. UPDATE TOUR CONTROLLER (Add getTourById Route)
createFile('apps/api/src/tour.controller.ts', `
import { Controller, Post, Get, Param, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
  async getAllTours(@Query() query: { search?: string; maxPrice?: string }) { 
    return this.tourService.getAllTours(query); 
  }

  @Get(':id')
  async getTourById(@Param('id') id: string) {
    return this.tourService.getTourById(id);
  }

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

// 3. CREATE TOUR DETAIL PAGE (Frontend)
createFile('apps/web/src/pages/TourDetail.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WishlistButton from '../components/WishlistButton';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/tours/' + id)
      .then(res => res.json())
      .then(data => { setTour(data); setLoading(false); })
      .catch(() => { alert('Tour not found'); navigate('/'); });
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading tour...</div>;
  if (!tour) return null;

  const handleBookNow = () => {
    if (!localStorage.getItem('token')) return navigate('/login');
    navigate('/checkout', { state: { tour } });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Image */}
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition flex items-center gap-2">
          ← Back to Explore
        </button>
        <div className="absolute top-6 right-6">
          <WishlistButton itemId={tour.id} itemType="tour" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-600 px-3 py-1 rounded-full text-xs font-bold">Tour</span>
            <span className="text-sm font-medium bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">⭐ {tour.avgRating} ({tour.reviewCount} reviews)</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{tour.title}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid md:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-10">
          {/* Organizer */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <img src={tour.organizer.profileImageUrl || 'https://via.placeholder.com/60'} alt="" className="w-16 h-16 rounded-full object-cover" />
            <div>
              <p className="text-sm text-slate-500">Operated by</p>
              <h3 className="text-xl font-bold text-slate-900">{tour.organizer.name}</h3>
              {tour.organizer.bio && <p className="text-sm text-slate-500 line-clamp-1">{tour.organizer.bio}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About this experience</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{tour.description}</p>
          </div>

          {/* Map */}
          {tour.lat !== 0 && tour.lng !== 0 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Meeting Location</h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200 z-0">
                <MapContainer center={[tour.lat, tour.lng]} zoom={13} style={{ height: '300px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[tour.lat, tour.lng]} />
                </MapContainer>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Reviews ({tour.reviewCount})</h2>
            {tour.reviews.length === 0 ? (
              <p className="text-slate-500">No reviews yet. Be the first to review after your trip!</p>
            ) : (
              <div className="space-y-4">
                {tour.reviews.map((r: any) => (
                  <div key={r.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                      <img src={r.user.profileImageUrl || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{r.user.name}</p>
                        <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="ml-auto text-yellow-400 font-bold">{'★'.repeat(r.rating)}</div>
                    </div>
                    <p className="text-slate-600 text-sm">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Booking Card */}
        <div className="md:col-span-1">
          <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 sticky top-8"
          >
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-slate-900">₹{tour.price}</span>
              {tour.paymentType === 'ADVANCE' && <span className="text-sm text-slate-500">(Advance: ₹{tour.advanceAmount})</span>}
            </div>
            
            <div className="space-y-3 mb-6 text-sm border-t border-b border-slate-100 py-4">
              <div className="flex justify-between"><span className="text-slate-500">Payment Type</span><span className="font-medium text-slate-900">{tour.paymentType === 'ADVANCE' ? 'Advance Booking' : 'Full Payment'}</span></div>
              {tour.gstPercentage > 0 && <div className="flex justify-between"><span className="text-slate-500">GST ({tour.gstPercentage}%)</span><span className="font-medium text-slate-900">₹{(tour.price * tour.gstPercentage) / 100}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Platform Fee</span><span className="font-medium text-slate-900">Included</span></div>
            </div>

            <button onClick={handleBookNow} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition mb-3">
              {tour.paymentType === 'ADVANCE' ? 'Book with Advance' : 'Book Now'}
            </button>
            <p className="text-xs text-slate-400 text-center">You won't be charged yet. Free cancellation up to 7 days before.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
`);

console.log('\n✨ Step 32 (Tour Detail Page) successfully generated!');
