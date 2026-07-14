const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add QR Code & Check-in status)
createFile('apps/api/prisma/schema.prisma', `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Destination {
  id          String   @id @default(uuid())
  name        String
  description String
  createdAt   DateTime @default(now())
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("TRAVELER")
  tours     Tour[]
  bookings  Booking[]
  createdAt DateTime @default(now())
}

model Tour {
  id          String   @id @default(uuid())
  title       String
  description String
  price       Float
  imageUrl    String
  organizerId String
  organizer   User     @relation(fields: [organizerId], references: [id])
  bookings    Booking[]
  createdAt   DateTime @default(now())
}

model Booking {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  tourId          String
  tour            Tour     @relation(fields: [tourId], references: [id])
  totalAmount     Float
  platformFee     Float
  organizerPayout Float
  status          String   @default("CONFIRMED")
  qrCode          String   @unique
  isCheckedIn     Boolean  @default(false)
  createdAt       DateTime @default(now())
}
`);

// 2. UPDATE BOOKING SERVICE (Generate QR & Verify Logic)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async createBooking(userId: string, tourId: string) {
    const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');

    const platformFee = tour.price * 0.05;
    const organizerPayout = tour.price - platformFee;
    const qrCode = \`VOY-\${tourId.slice(-4)}-\${userId.slice(-4)}-\${Date.now().toString(36)}\`;

    return this.prisma.booking.create({
      data: {
        userId, tourId, totalAmount: tour.price, platformFee, organizerPayout,
        status: 'CONFIRMED', qrCode,
      },
    });
  }

  async getMyBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { tour: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyTicket(qrCode: string) {
    const booking = await this.prisma.booking.findUnique({ where: { qrCode } });
    if (!booking) throw new NotFoundException('Invalid Ticket: Booking does not exist.');
    
    if (booking.isCheckedIn) throw new BadRequestException('Ticket already used!');

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { isCheckedIn: true },
    });

    return { success: true, message: 'Check-in successful!' };
  }
}
`);

// 3. UPDATE BOOKING CONTROLLER (Add Verify Route)
createFile('apps/api/src/booking.controller.ts', `
import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    try { req.user = this.jwtService.verify(token); return true; } catch (e) { return false; }
  }
}

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async createBooking(@Request() req: any, @Body() body: { tourId: string }) {
    return this.bookingService.createBooking(req.user.sub, body.tourId);
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

// 4. UPDATE TRAVELER WALLET (Add QR Code Image)
createFile('apps/web/src/pages/MyBookings.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    fetch('http://localhost:3000/bookings/mine', { headers: { 'Authorization': \`Bearer \${token}\` } })
      .then(res => res.json()).then(data => setBookings(data));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">My Tickets</h1>
          <button onClick={() => navigate('/')} className="text-indigo-400 hover:text-indigo-300">← Back to Home</button>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-gray-800 p-8 rounded-2xl text-center text-gray-400">You haven't booked any tours yet.</div>
        ) : (
          <div className="space-y-6">
            {bookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col md:flex-row gap-6 items-center">
                
                {/* Ticket Details */}
                <div className="flex-grow">
                  <h3 className="text-2xl font-bold mb-1">{b.tour.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">Booked on: {new Date(b.createdAt).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className={\`px-3 py-1 rounded-full font-semibold \${b.isCheckedIn ? 'bg-gray-600 text-gray-300' : 'bg-green-100 text-green-700'}\`}>
                      {b.isCheckedIn ? 'Used' : 'Valid'}
                    </span>
                    <span className="text-gray-300">Total Paid: <b>₹{b.totalAmount}</b></span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="bg-white p-3 rounded-xl flex flex-col items-center">
                  <img src={\`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=\${b.qrCode}\`} alt="QR Ticket" />
                  <p className="text-gray-800 text-xs font-mono mt-1">{b.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`);

// 5. CREATE ORGANIZER SCANNER PAGE
createFile('apps/web/src/pages/Scanner.tsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Scanner() {
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const token = localStorage.getItem('token');
    
    const res = await fetch('http://localhost:3000/bookings/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
      body: JSON.stringify({ qrCode })
    });
    const data = await res.json();
    
    if (res.ok) {
      setResult({ success: true, message: data.message });
      setQrCode('');
    } else {
      setResult({ success: false, message: data.message || 'Verification failed' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <button onClick={() => navigate('/dashboard')} className="absolute top-8 left-8 text-indigo-400 hover:text-indigo-300">← Dashboard</button>
      
      <h1 className="text-4xl font-extrabold mb-8">Ticket Scanner</h1>
      
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl">
        <form onSubmit={handleVerify} className="space-y-4 mb-6">
          <label className="block text-sm font-medium text-gray-400">Enter Ticket QR Code</label>
          <input 
            type="text" required value={qrCode} onChange={(e) => setQrCode(e.target.value)}
            className="w-full p-3 bg-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="e.g., VOY-1234-5678-abc"
          />
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50">
            {loading ? 'Verifying...' : 'Verify Ticket'}
          </button>
        </form>

        <AnimatePresence>
          {result && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={\`p-4 rounded-xl text-center font-semibold \${result.success ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}\`}
            >
              {result.success ? '✓ ' : '✕ '}{result.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
`);

// 6. UPDATE DASHBOARD (Add Scanner Button)
createFile('apps/web/src/pages/Dashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tours, setTours] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', price: 0, imageUrl: '' });

  const fetchTours = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const res = await fetch('http://localhost:3000/tours');
    const data = await res.json();
    setTours(data);
  };

  useEffect(() => { fetchTours(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      setShowForm(false);
      setFormData({ title: '', description: '', price: 0, imageUrl: '' });
      fetchTours();
    }
  };

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">Organizer Dashboard</h1>
          <div className="flex gap-4">
            <button onClick={() => navigate('/scanner')} className="bg-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-purple-500">Scan Tickets</button>
            <button onClick={logout} className="bg-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-500">Logout</button>
          </div>
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-1">Your Tour Packages</h2>
            <p className="text-gray-400">Manage and create new travel experiences.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition whitespace-nowrap">
            + Create New Tour
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tours.length === 0 ? (
            <p className="text-gray-400">No tours created yet.</p>
          ) : (
            tours.map(tour => (
              <div key={tour.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <h3 className="text-xl font-bold mb-1">{tour.title}</h3>
                  <p className="text-gray-400 text-sm mb-2">{tour.description}</p>
                  <p className="text-indigo-400 font-bold">₹{tour.price}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-gray-800 p-8 rounded-2xl w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6">Create New Tour</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <input type="text" required placeholder="Tour Title" value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none" />
                <textarea required placeholder="Description" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none h-24" />
                <input type="number" required placeholder="Price (₹)" value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none" />
                <input type="url" required placeholder="Image URL" value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none" />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-500">Cancel</button>
                  <button type="submit" className="flex-1 bg-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-500">Save Tour</button>
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

// 7. UPDATE APP.TSX (Add Scanner Route)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import AIPlanner from './pages/AIPlanner';
import Scanner from './pages/Scanner';

function Home() {
  const [destinations, setDestinations] = useState([]);
  const [tours, setTours] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:3000/destinations').then(res => res.json()).then(data => setDestinations(data));
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
  }, []);

  const handleBookNow = (tour: any) => {
    if (!isLoggedIn) navigate('/login');
    else navigate('/checkout', { state: { tour } });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Voyagora<span className="text-indigo-400">.</span></h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="px-4 py-2 text-purple-400 hover:text-purple-300 transition font-semibold flex items-center gap-2">
            ✨ AI Planner
          </button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="px-4 py-2 text-gray-300 hover:text-white transition">My Bookings</button>}
          <button onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')} className="px-6 py-2 bg-indigo-600 rounded-full font-semibold hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/50">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
      </nav>

      <header className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center scale-105 blur-sm" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div className="relative z-20 text-center px-4">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight">Explore the Unexplored</motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">Your Travel Operating System. Discover hidden gems, book local experiences, and build itineraries with AI.</motion.p>
          <div className="flex justify-center">
            <input type="text" placeholder="Where do you want to go?" className="px-6 py-4 w-full max-w-md rounded-l-xl text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            <button className="bg-indigo-600 px-8 rounded-r-xl font-bold hover:bg-indigo-500 transition">Search</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 py-16">
        <h3 className="text-3xl font-bold mb-8">Featured Tours by Organizers</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tours.map((tour: any, i) => (
            <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl group cursor-pointer flex flex-col">
              <div className="h-48 overflow-hidden">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-indigo-400 uppercase tracking-wider">{tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1">{tour.title}</h4>
                <p className="text-gray-400 mb-4 line-clamp-2 flex-grow">{tour.description}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-2xl font-bold text-green-400">₹{tour.price}</span>
                  <button onClick={() => handleBookNow(tour)} className="bg-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-500 transition">Book Now</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/ai-planner" element={<AIPlanner />} />
        <Route path="/scanner" element={<Scanner />} />
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 6 (QR Ticketing & Scanner) successfully generated!');
