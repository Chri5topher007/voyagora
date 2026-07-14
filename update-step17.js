const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Subscription Status)
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
  subscriptionStatus String   @default("INACTIVE") // INACTIVE or ACTIVE
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

// 2. UPDATE AUTH SERVICE (Return sub status, add mock pay endpoint)
createFile('apps/api/src/auth.service.ts', `
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(dto: { email: string; password: string; name: string; role: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashedPassword, name: dto.name, role: dto.role }
    });

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus } };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus } };
  }

  async activateSubscription(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'ACTIVE' }
    });
    return { success: true, message: 'Subscription activated!' };
  }
}
`);

// 3. UPDATE AUTH CONTROLLER (Add Activate Route)
createFile('apps/api/src/auth.controller.ts', `
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private jwtService: JwtService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; name: string; role: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('activate-subscription')
  activate(@Request() req: any) {
    return this.authService.activateSubscription(req.user.sub);
  }
}
`);

// 4. CREATE PREMIUM LOGIN PAGE (Split Screen + Responsive)
createFile('apps/web/src/pages/Login.tsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('TRAVELER');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin ? { email: formData.email, password: formData.password } : { ...formData, role };

    try {
      const res = await fetch('http://localhost:3000/auth/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        localStorage.setItem('subStatus', data.user.subscriptionStatus);
        
        if (data.user.role === 'ADMIN') navigate('/admin');
        else if (data.user.role === 'ORGANIZER') {
          if (data.user.subscriptionStatus === 'ACTIVE') navigate('/dashboard');
          else navigate('/pricing');
        }
        else navigate('/traveler-dashboard');
      } else {
        alert(data.message || 'Something went wrong');
      }
    } catch (err) {
      alert('Network Error: Backend is not running.');
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Image Side (Hidden on Mobile) */}
      <div className="hidden md:flex w-1/2 bg-cover bg-center relative" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1000&q=80')" }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-extrabold mb-4">Explore the Unexplored.</h2>
          <p className="text-lg text-gray-200">Join the ultimate travel ecosystem. Discover, book, and manage your journeys.</p>
        </div>
      </div>

      {/* Right Form Side */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100"
        >
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Voyagora<span className="text-indigo-600">.</span></h1>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>

          {!isLogin && (
            <div className="flex gap-4 mb-6 bg-slate-100 p-2 rounded-xl">
              <button onClick={() => setRole('TRAVELER')} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (role === 'TRAVELER' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Traveler</button>
              <button onClick={() => setRole('ORGANIZER')} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (role === 'ORGANIZER' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Organizer</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <input type="text" required placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm" />
            )}
            <input type="email" required placeholder="Email Address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm" />
            <input type="password" required placeholder="Password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm" />
            
            <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition text-sm">
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-slate-500 mt-6 text-sm hover:text-slate-800">
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
`);

// 5. CREATE PRICING PAGE (Organizer Paywall)
createFile('apps/web/src/pages/Pricing.tsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/auth/activate-subscription', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    localStorage.setItem('subStatus', 'ACTIVE');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Choose Your Plan</h1>
        <p className="text-slate-500">Unlock your organizer dashboard and start selling today.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl w-full">
        {[
          { name: 'Starter', price: '₹999', features: ['Up to 5 Active Listings', 'Basic Analytics', 'Standard Support'] },
          { name: 'Professional', price: '₹2,999', features: ['Unlimited Listings', 'Advanced Heat Maps', 'Featured Listings (2/mo)', 'Priority Support'], popular: true },
          { name: 'Enterprise', price: '₹9,999', features: ['Everything in Pro', 'API Access', 'Dedicated Account Manager', 'Custom Integrations'] }
        ].map((plan, i) => (
          <motion.div 
            key={plan.name} 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={"bg-white p-8 rounded-2xl shadow-sm border " + (plan.popular ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-slate-200')}
          >
            {plan.popular && <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-semibold">MOST POPULAR</span>}
            <h3 className="text-xl font-bold text-slate-900 mt-4 mb-2">{plan.name}</h3>
            <p className="text-4xl font-extrabold mb-6">{plan.price}<span className="text-base font-normal text-slate-500">/mo</span></p>
            <ul className="space-y-3 mb-8 text-sm">
              {plan.features.map(f => <li key={f} className="text-slate-600 flex items-center gap-2"><span className="text-green-500">✓</span> {f}</li>)}
            </ul>
            <button onClick={handleSubscribe} disabled={loading} className={"w-full py-3 rounded-xl font-bold text-sm transition " + (plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')}>
              {loading ? 'Processing...' : 'Subscribe & Pay'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
`);

// 6. UPDATE APP.TSX (Add Pricing Route & Fix Mobile Nav)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TravelerDashboard from './pages/TravelerDashboard';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import AIPlanner from './pages/AIPlanner';
import Scanner from './pages/Scanner';
import HiddenGems from './pages/HiddenGems';
import AdminDashboard from './pages/AdminDashboard';
import Pricing from './pages/Pricing';
import MapModal from './components/MapModal';

function Home() {
  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [gems, setGems] = useState([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false); // Mobile menu state
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
    fetch('http://localhost:3000/events').then(res => res.json()).then(data => setEvents(data));
    fetch('http://localhost:3000/community').then(res => res.json()).then(data => setGems(data));
  }, []);

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
      {/* RESPONSIVE NAVBAR */}
      <nav className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl px-4 md:px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg">V</span>
          Voyagora
        </h1>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex gap-8 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">✨ AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-600 hover:text-red-700 font-medium transition">Admin</button>}
          <button onClick={handleDashboardClick} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition shadow-md">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-800 text-2xl">☰</button>
      </nav>

      {/* Mobile Dropdown Menu */}
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

      {/* IMMERSIVE HERO SECTION */}
      <header className="relative h-[100vh] flex items-end overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
        
        <div className="relative z-20 w-full max-w-7xl mx-auto p-4 md:p-8 pb-24">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-3xl">
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6 inline-block">🌍 The Ultimate Travel Operating System</span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tighter text-white leading-none">Explore the <br/><span className="text-indigo-400">Unexplored</span></h2>
            <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-xl font-light">Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here.</p>
            
            <div className="bg-white p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl">
              <div className="flex-grow flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📍</span>
                <input type="text" placeholder="Where do you want to go?" className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📅</span>
                <input type="text" placeholder="Add dates" className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">Search</button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* TRUST BADGES */}
      <div className="bg-slate-900 py-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-around items-center gap-4 md:gap-8 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-wider">
          <span>⭐ 4.9/5 Traveler Rating</span>
          <span>🔒 Secure Payments</span>
          <span>🛡️ Verified Organizers</span>
          <span>⚡ Instant Confirmation</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        {/* FEATURED TOURS */}
        <div className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-indigo-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Curated for you</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Featured Tours</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {tours.map((tour: any, i) => (
            <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
              <div className="h-56 md:h-72 overflow-hidden relative">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{tour.price}</span></div>
                <span className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Tour</span>
              </div>
              <div className="p-5 md:p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">By {tour.organizer.name}</span>
                <h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{tour.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{tour.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs md:text-sm">⭐ 4.8 (240 reviews)</span>
                    <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-indigo-600 transition text-xs md:text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(tour)} className="text-slate-500 text-xs md:text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* UPCOMING EVENTS */}
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
                <span className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Event</span>
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

        {/* HIDDEN GEMS */}
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

      {/* PREMIUM FOOTER */}
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

console.log('\n✨ Step 17 (Premium UI, Paywall, Responsive) successfully generated!');
