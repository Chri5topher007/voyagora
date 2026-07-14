const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Tour Model)
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
  createdAt   DateTime @default(now())
}
`);

// 2. CREATE TOUR SERVICE (Logic to create/fetch tours)
createFile('apps/api/src/tour.service.ts', `
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}

  async createTour(organizerId: string, dto: { title: string; description: string; price: number; imageUrl: string }) {
    return this.prisma.tour.create({
      data: { ...dto, organizerId },
    });
  }

  async getAllTours() {
    return this.prisma.tour.findMany({
      include: { organizer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getToursByOrganizer(organizerId: string) {
    return this.prisma.tour.findMany({ where: { organizerId } });
  }
}
`);

// 3. CREATE TOUR CONTROLLER (API Routes)
createFile('apps/api/src/tour.controller.ts', `
import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { TourService } from './tour.service';
import { JwtService } from '@nestjs/jwt';

// A simple guard to check if the user is logged in
class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    try {
      req.user = this.jwtService.verify(token);
      return true;
    } catch (e) { return false; }
  }
}

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService, private jwtService: JwtService) {}

  @Get()
  async getAllTours() {
    return this.tourService.getAllTours();
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async createTour(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'ORGANIZER') throw new Error('Only organizers can create tours');
    return this.tourService.createTour(req.user.sub, body);
  }
}
`);

// 4. UPDATE APP MODULE (Wire up Tour Service/Controller)
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'super_secret_voyagora_key_123',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AppController, AuthController, TourController],
  providers: [PrismaService, AuthService, TourService],
})
export class AppModule {}
`);

// 5. UPDATE ORGANIZER DASHBOARD (Add Create Tour Form & List)
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

  const logout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">Organizer Dashboard</h1>
          <button onClick={logout} className="bg-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-500">Logout</button>
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

      {/* Create Tour Modal */}
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

// 6. UPDATE HOME PAGE (Display Organizer Tours at the bottom)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function Home() {
  const [destinations, setDestinations] = useState([]);
  const [tours, setTours] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/destinations').then(res => res.json()).then(data => setDestinations(data));
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
  }, []);

  const handleAuthClick = () => {
    if (isLoggedIn) navigate('/dashboard');
    else navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Voyagora<span className="text-indigo-400">.</span></h1>
        <button onClick={handleAuthClick} className="px-6 py-2 bg-indigo-600 rounded-full font-semibold hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/50">
          {isLoggedIn ? 'Dashboard' : 'Get Started'}
        </button>
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
        <h3 className="text-3xl font-bold mb-8">Trending Destinations</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {destinations.map((dest: any, i) => (
            <motion.div key={dest.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl group cursor-pointer">
              <div className="h-64 overflow-hidden">
                <img src={"https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80"} alt={dest.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <h4 className="text-2xl font-bold mb-2">{dest.name}</h4>
                <p className="text-gray-400 mb-4">{dest.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <h3 className="text-3xl font-bold mb-8">Featured Tours by Organizers</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tours.map((tour: any, i) => (
            <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl group cursor-pointer">
              <div className="h-48 overflow-hidden">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <span className="text-xs text-indigo-400 uppercase tracking-wider">{tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1">{tour.title}</h4>
                <p className="text-gray-400 mb-4 line-clamp-2">{tour.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-green-400">₹{tour.price}</span>
                  <button className="bg-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-500 transition">Book Now</button>
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
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 3 (Tours & Inventory) successfully generated!');
