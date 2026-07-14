const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add CommunityPlace Model)
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
  places    CommunityPlace[]
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

model CommunityPlace {
  id          String   @id @default(uuid())
  name        String
  description String
  imageUrl    String
  status      String   @default("PENDING") // PENDING, APPROVED, REJECTED
  uploadedBy  String
  user        User     @relation(fields: [uploadedBy], references: [id])
  createdAt   DateTime @default(now())
}
`);

// 2. CREATE COMMUNITY SERVICE
createFile('apps/api/src/community.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async submitPlace(userId: string, dto: { name: string; description: string; imageUrl: string }) {
    return this.prisma.communityPlace.create({
      data: { ...dto, uploadedBy: userId },
    });
  }

  async getApprovedPlaces() {
    return this.prisma.communityPlace.findMany({ where: { status: 'APPROVED' } });
  }

  async getPendingPlaces() {
    return this.prisma.communityPlace.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { name: true } } },
    });
  }

  async approvePlace(id: string) {
    return this.prisma.communityPlace.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }
}
`);

// 3. CREATE COMMUNITY CONTROLLER
createFile('apps/api/src/community.controller.ts', `
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CommunityService } from './community.service';
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

@Controller('community')
export class CommunityController {
  constructor(private readonly cs: CommunityService, private jwtService: JwtService) {}

  @Get()
  async getApproved() {
    return this.cs.getApprovedPlaces();
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async submit(@Request() req: any, @Body() body: { name: string; description: string; imageUrl: string }) {
    return this.cs.submitPlace(req.user.sub, body);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('pending')
  async getPending(@Request() req: any) {
    if (req.user.role !== 'ADMIN') throw new Error('Admin only');
    return this.cs.getPendingPlaces();
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Patch(':id/approve')
  async approve(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'ADMIN') throw new Error('Admin only');
    return this.cs.approvePlace(id);
  }
}
`);

// 4. UPDATE APP MODULE
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
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
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService],
})
export class AppModule {}
`);

// 5. CREATE HIDDEN GEMS PAGE (Traveler Uploads)
createFile('apps/web/src/pages/HiddenGems.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function HiddenGems() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', imageUrl: '' });

  const fetchPlaces = () => fetch('http://localhost:3000/community').then(res => res.json()).then(data => setPlaces(data));

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
    fetchPlaces();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
      body: JSON.stringify(formData)
    });
    setShowForm(false);
    setFormData({ name: '', description: '', imageUrl: '' });
    alert('Submitted! It will appear once an Admin approves it.');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">Hidden Gems 💎</h1>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-500">+ Share a Gem</button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {places.map(p => (
            <div key={p.id} className="bg-gray-800 rounded-2xl overflow-hidden">
              <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-cover" />
              <div className="p-4">
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="text-gray-400 text-sm">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-800 p-8 rounded-2xl w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6">Share a Hidden Gem</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" required placeholder="Name (e.g., Secret Waterfall)" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-gray-700 rounded-xl outline-none" />
                <textarea required placeholder="Description" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-gray-700 rounded-xl outline-none h-24" />
                <input type="url" required placeholder="Image URL" value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full p-3 bg-gray-700 rounded-xl outline-none" />
                <button type="submit" className="w-full bg-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-500">Submit for Review</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
`);

// 6. CREATE ADMIN DASHBOARD (Approval Queue)
createFile('apps/web/src/pages/AdminDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<any[]>([]);

  const fetchPending = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const res = await fetch('http://localhost:3000/community/pending', {
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    if (res.status === 403) { alert('Admins only'); navigate('/'); return; }
    const data = await res.json();
    setPlaces(data);
  };

  useEffect(() => { fetchPending(); }, []);

  const approve = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(\`http://localhost:3000/community/\${id}/approve\`, {
      method: 'PATCH',
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    fetchPending(); // Refresh queue
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8">Admin: Approval Queue</h1>
        
        {places.length === 0 ? (
          <div className="bg-gray-800 p-8 rounded-2xl text-gray-400">Queue is empty! 🎉</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {places.map(place => (
              <motion.div key={place.id} layout className="bg-gray-800 rounded-2xl shadow-lg p-6 flex gap-4">
                <img src={place.imageUrl} alt="" className="w-32 h-32 object-cover rounded-xl" />
                <div className="flex-grow">
                  <h2 className="text-xl font-bold">{place.name}</h2>
                  <p className="text-sm text-gray-500 mb-2">By: {place.user.name}</p>
                  <p className="text-gray-400 line-clamp-2 mb-4">{place.description}</p>
                  <button onClick={() => approve(place.id)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-500">
                    Approve & Publish
                  </button>
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

// 7. UPDATE APP.TSX (Add Routes & Nav Buttons)
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
import HiddenGems from './pages/HiddenGems';
import AdminDashboard from './pages/AdminDashboard';

function Home() {
  const [destinations, setDestinations] = useState([]);
  const [tours, setTours] = useState([]);
  const [gems, setGems] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/destinations').then(res => res.json()).then(data => setDestinations(data));
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
    fetch('http://localhost:3000/community').then(res => res.json()).then(data => setGems(data));
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
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="px-4 py-2 text-purple-400 hover:text-purple-300 font-semibold">✨ AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="px-4 py-2 text-yellow-400 hover:text-yellow-300 font-semibold">💎 Hidden Gems</button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="px-4 py-2 text-gray-300 hover:text-white">My Bookings</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="px-4 py-2 text-red-400 hover:text-red-300 font-semibold">Admin</button>}
          <button onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')} className="px-6 py-2 bg-indigo-600 rounded-full font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-600/50">
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
            <button className="bg-indigo-600 px-8 rounded-r-xl font-bold hover:bg-indigo-500">Search</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 py-16">
        <h3 className="text-3xl font-bold mb-8">Featured Tours by Organizers</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
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
                  <button onClick={() => handleBookNow(tour)} className="bg-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-500">Book Now</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <h3 className="text-3xl font-bold mb-8">Community Hidden Gems 💎</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {gems.map((gem: any, i) => (
            <motion.div key={gem.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl">
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-40 object-cover" />
              <div className="p-4">
                <h4 className="text-xl font-bold">{gem.name}</h4>
                <p className="text-gray-400 text-sm">{gem.description}</p>
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
        <Route path="/hidden-gems" element={<HiddenGems />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 7 (Community & Admin) successfully generated!');
