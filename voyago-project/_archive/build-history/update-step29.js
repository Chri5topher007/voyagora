const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Profile Image & Bio to User)
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

// 2. CREATE USER SERVICE (Get & Update Profile)
createFile('apps/api/src/user.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getMe(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, profileImageUrl: true, bio: true, subscriptionStatus: true }
    });
  }

  async updateMe(id: string, dto: { name: string; bio: string; profileImageUrl: string }) {
    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, bio: dto.bio, profileImageUrl: dto.profileImageUrl },
      select: { id: true, name: true, email: true, role: true, profileImageUrl: true, bio: true, subscriptionStatus: true }
    });
  }
}
`);

// 3. CREATE USER CONTROLLER
createFile('apps/api/src/user.controller.ts', `
import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
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

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('me')
  async getMe(@Request() req: any) { return this.userService.getMe(req.user.sub); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Patch('me')
  async updateMe(@Request() req: any, @Body() body: any) { return this.userService.updateMe(req.user.sub, body); }
}
`);

// 4. UPDATE APP MODULE (Wire up User Module)
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
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService],
})
export class AppModule {}
`);

// 5. CREATE PROFILE PAGE (Frontend UI)
createFile('apps/web/src/pages/Profile.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ImageUpload from '../components/ImageUpload';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', bio: '', profileImageUrl: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    fetch('http://localhost:3000/users/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(res => res.json()).then(data => {
        setUser(data);
        setFormData({ name: data.name || '', bio: data.bio || '', profileImageUrl: data.profileImageUrl || '' });
      });
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(formData)
    });
    setLoading(false);
    alert('Profile updated!');
  };

  if (!user) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button onClick={() => navigate(user.role === 'ORGANIZER' ? '/dashboard' : '/traveler-dashboard')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">← Back to Dashboard</button>
        </nav>
      </aside>

      <main className="flex-grow p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-lg w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">My Profile</h2>
          
          <div className="flex items-center gap-4 mb-8">
            <img src={formData.profileImageUrl || 'https://via.placeholder.com/80'} alt="Avatar" className="w-20 h-20 rounded-full object-cover bg-slate-100" />
            <div>
              <p className="font-bold text-lg text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bio / Description</label>
              <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none h-24 text-slate-800" placeholder="Tell us about yourself..."></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profile Picture</label>
              <ImageUpload onUpload={(url) => setFormData({ ...formData, profileImageUrl: url })} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
`);

// 6. UPDATE APP.TSX (Add Profile Route & Nav Link)
// We will just inject the Profile route and update the nav menu to include it.
// Since App.tsx is large, I'll provide the exact search/replace for the Nav section.
// To make it robust via script, I'll rewrite App.tsx entirely.
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
import Profile from './pages/Profile';
import MapModal from './components/MapModal';
import WishlistButton from './components/WishlistButton';

function Home() {
  const [allTours, setAllTours] = useState<any[]>([]);
  const [filteredTours, setFilteredTours] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [gems, setGems] = useState<any[]>([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
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
          {isLoggedIn && <button onClick={() => navigate('/profile')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Profile</button>}
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
          {isLoggedIn && <button onClick={() => { navigate('/profile'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">Profile</button>}
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
          {events.map
