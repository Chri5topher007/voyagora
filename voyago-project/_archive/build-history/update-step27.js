const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE TOUR SERVICE (Add Search & Filter Logic)
createFile('apps/api/src/tour.service.ts', `
import { Injectable } from '@nestjs/common';
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

// 2. UPDATE TOUR CONTROLLER (Pass Query Params)
createFile('apps/api/src/tour.controller.ts', `
import { Controller, Post, Get, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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

// 3. CREATE ADMIN SERVICE & CONTROLLER (Platform Analytics)
createFile('apps/api/src/admin.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const totalUsers = await this.prisma.user.count();
    const totalOrganizers = await this.prisma.user.count({ where: { role: 'ORGANIZER' } });
    const totalTours = await this.prisma.tour.count();
    const totalEvents = await this.prisma.event.count();
    const totalBookings = await this.prisma.booking.count();
    
    const bookings = await this.prisma.booking.findMany();
    const platformRevenue = bookings.reduce((acc, b) => acc + b.platformFee, 0);
    const grossVolume = bookings.reduce((acc, b) => acc + b.amountPaid, 0);

    return { totalUsers, totalOrganizers, totalTours, totalEvents, totalBookings, platformRevenue, grossVolume };
  }
}
`);

createFile('apps/api/src/admin.controller.ts', `
import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';
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

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('stats')
  async getStats(@Request() req: any) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin access only');
    return this.adminService.getPlatformStats();
  }
}
`);

// 4. UPDATE APP MODULE (Wire up Admin)
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
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService],
})
export class AppModule {}
`);

// 5. UPGRADE ADMIN DASHBOARD (Real Platform Analytics)
createFile('apps/web/src/pages/AdminDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalOrganizers: 0, totalTours: 0, totalEvents: 0, totalBookings: 0, platformRevenue: 0, grossVolume: 0 });

  const fetchPending = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const res = await fetch('http://localhost:3000/community/pending', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 403) { navigate('/'); return; }
    const data = await res.json();
    setPlaces(data);
  };

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) setStats(await res.json());
  };

  useEffect(() => { fetchPending(); fetchStats(); }, []);

  const approve = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/community/' + id + '/approve', { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token } });
    fetchPending();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-red-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-red-400 font-semibold flex items-center gap-2">🛡️ Admin Control</button>
          <button onClick={() => navigate('/')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">🏠 View Site</button>
        </nav>
        <button onClick={() => { localStorage.clear(); navigate('/'); }} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      <main className="flex-grow p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800">Admin Control Center</h2>
          <p className="text-slate-500">Platform-wide analytics and moderation.</p>
        </div>

        {/* Platform Analytics */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Platform Revenue (Fees)</p>
            <h3 className="text-3xl font-bold text-green-600">₹{stats.platformRevenue.toLocaleString()}</h3>
            <p className="text-slate-400 text-xs mt-2">From 5% booking fees</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Gross Volume</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{stats.grossVolume.toLocaleString()}</h3>
            <p className="text-slate-400 text-xs mt-2">Total money processed</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Users</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalUsers}</h3>
            <p className="text-slate-400 text-xs mt-2">{stats.totalOrganizers} Organizers</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Bookings</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalBookings}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Active Tours</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalTours}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Active Events</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalEvents}</h3>
          </div>
        </div>

        {/* Approval Queue */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-800">Pending Approvals ({places.length})</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {places.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-center md:col-span-2">Queue is empty! 🎉</div>
          ) : (
            places.map(place => (
              <motion.div key={place.id} layout className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex gap-6">
                <img src={place.imageUrl} alt="" className="w-32 h-32 object-cover rounded-xl" />
                <div className="flex-grow flex flex-col">
                  <h4 className="text-xl font-bold text-slate-800">{place.name}</h4>
                  <p className="text-xs text-slate-400 mb-2">Submitted by: {place.user.name}</p>
                  <p className="text-slate-600 text-sm line-clamp-3 mb-4 flex-grow">{place.description}</p>
                  <button onClick={() => approve(place.id)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-500 w-full md:w-auto self-start">Approve & Publish</button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
`);

// 6. UPGRADE HOME PAGE (Working Search & Filter)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TravelerDashboard from './pages/TravelerDashboard';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import MyBookings from './pages/MyBookings';
import AIPlanner from './pages/AIPlanner';
import Scanner from './pages/Scanner';
import HiddenGems from './pages/HiddenGems';
import AdminDashboard from './pages/AdminDashboard';
import Pricing from './pages/Pricing';
import MapModal from './components/MapModal';
import WishlistButton from './components/WishlistButton';

function Home() {
  const [allTours, setAllTours] = useState([]);
  const [filteredTours, setFilteredTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [gems, setGems] = useState([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => { setAllTours(data); setFilteredTours(data); });
    fetch('http://localhost:3000/events').then(res => res.json()).then(data => setEvents(data));
    fetch('http://localhost:3000/community').then(res => res.json()).then(data => setGems(data));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    let results = allTours;
    if (searchQuery) {
      results = results.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (maxPrice) {
      results = results.filter(t => t.price <= Number(maxPrice));
    }
    setFilteredTours(results);
    
    // Scroll to tours section
    document.getElementById('tours-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBookNow = (item: any, type: 'tour' | 'event') => {
    if (!isLoggedIn) navigate('/login');
    else navigate('/checkout', { state: { [type]: item } });
  };

  const handleDashboardClick = () => {
    if (!isLoggedIn) return navigate('/login');
    if (role === 'ADMIN') navigate('/admin');
    else if (role === 'ORGANIZER') {
      if (localStorage.getItem('subStatus') === 'ACTIVE') navigate('/dashboard');
      else navigate('/pricing');
    }
    else navigate('/traveler-dashboard');
  };

  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100">
      <nav className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl px-4 md:px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg">V</span>
          Voyagora
        </h1>
        <div className="hidden md:flex gap-8 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">✨ AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-600 hover:text-red-700 font-medium transition">Admin</button>}
          <button onClick={handleDashboardClick} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition shadow-md">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-800 text-2xl">☰</button>
      </nav>

      {menuOpen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex flex-col gap-4 md:hidden">
          <button onClick={() => { navigate(isLoggedIn ? '/ai-planner' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">✨ AI Planner</button>
          <button onClick={() => { navigate(isLoggedIn ? '/hidden-gems' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => { navigate('/my-bookings'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => { navigate('/admin'); setMenuOpen(false); }} className="text-left text-red-600 font-medium py-2">Admin</button>}
          <button onClick={() => { handleDashboardClick(); setMenuOpen(false); }} className="bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-semibold text-center">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
      )}

      <header className="relative h-[100vh] flex items-end overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
        <div className="relative z-20 w-full max-w-7xl mx-auto p-4 md:p-8 pb-24">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-3xl">
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6 inline-block">🌍 The Ultimate Travel Operating System</span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tighter text-white leading-none">Explore the <br/><span className="text-indigo-400">Unexplored</span></h2>
            <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-xl font-light">Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here.</p>
            
            {/* WORKING SEARCH & FILTER */}
            <form onSubmit={handleSearch} className="bg-white p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl">
              <div className="flex-grow flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📍</span>
                <input type="text" placeholder="Where do you want to go?" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">💰</span>
                <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">Search</button>
            </form>
          </motion.div>
        </div>
      </header>

      <div className="bg-slate-900 py-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-around items-center gap-4 md:gap-8 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-wider">
          <span>⭐ 4.9/5 Traveler Rating</span>
          <span>🔒 Secure Payments</span>
          <span>🛡️ Verified Organizers</span>
          <span>⚡ Instant Confirmation</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div id="tours-section" className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-indigo-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Curated for you</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Featured Tours</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {filteredTours.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500">No tours found matching your search.</div>
          ) : (
            filteredTours.map((tour: any, i) => (
              <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
                <div className="h-56 md:h-72 overflow-hidden relative">
                  <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{tour.price}</span></div>
                  <WishlistButton itemId={tour.id} itemType="tour" />
                </div>
                <div className="p-5 md:p-6 flex-grow flex flex-col">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">By {tour.organizer.name}</span>
                  <h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{tour.title}</h4>
                  <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{tour.description}</p>
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-xs md:text-sm">⭐ {tour.avgRating || '0.0'} ({tour.reviewCount} reviews)</span>
                      <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-indigo-600 transition text-xs md:text-sm">Book Now</button>
                    </div>
                    <button onClick={() => setActiveMap(tour)} className="text-slate-500 text-xs md:text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-purple-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Don't miss out</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Upcoming Events</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {events.map((event: any, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
              <div className="h-56 md:h-72 overflow-hidden relative">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{event.price}</span></div>
                <WishlistButton itemId={event.id} itemType="event" />
              </div>
              <div className="p-5 md:p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">{new Date(event.eventDate).toLocaleDateString()}</span>
                <h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{event.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{event.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs md:text-sm">Limited seats</span>
                    <button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-purple-600 transition text-xs md:text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(event)} className="text-slate-500 text-xs md:text-sm hover:text-purple-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-yellow-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Community Driven</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Hidden Gems 💎</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {gems.map((gem: any, i) => (
            <motion.div key={gem.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1" onClick={() => setActiveMap(gem)}>
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-32 md:h-40 object-cover" />
              <div className="p-3 md:p-4">
                <h4 className="font-bold text-base md:text-lg text-slate-900">{gem.name}</h4>
                <p className="text-slate-500 text-xs md:text-sm line-clamp-2">{gem.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-white mb-4">Voyagora<span className="text-indigo-400">.</span></h1>
            <p className="text-xs md:text-sm">Your Travel Operating System. Discover, book, and explore the world.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Platform</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li className="hover:text-white cursor-pointer">Tours</li><li className="hover:text-white cursor-pointer">Events</li><li className="hover:text-white cursor-pointer">Hidden Gems</li><li className="hover:text-white cursor-pointer">AI Planner</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Company</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li className="hover:text-white cursor-pointer">About Us</li><li className="hover:text-white cursor-pointer">Careers</li><li className="hover:text-white cursor-pointer">Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Newsletter</h4>
            <p className="text-xs md:text-sm mb-4">Get the best travel deals weekly.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email address" className="bg-slate-800 px-4 py-2 rounded-lg text-xs md:text-sm text-white outline-none flex-grow" />
              <button className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500">→</button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-8 md:mt-12 pt-8 text-center text-xs md:text-sm">© 2024 Voyagora Ecosystem. Built for Travelers, by Travelers.</div>
      </footer>

      {activeMap && ( <MapModal lat={activeMap.lat} lng={activeMap.lng} title={activeMap.title || activeMap.name} onClose={() => setActiveMap(null)} /> )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/traveler-dashboard" element={<TravelerDashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/ai-planner" element={<AIPlanner />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/hidden-gems" element={<HiddenGems />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 27 (Search/Filter & Admin Analytics) successfully generated!');
