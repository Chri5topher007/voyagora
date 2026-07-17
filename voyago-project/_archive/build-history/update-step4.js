const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Booking Model & Relations)
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
  createdAt       DateTime @default(now())
}
`);

// 2. CREATE BOOKING SERVICE (Logic for 5% commission & saving booking)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async createBooking(userId: string, tourId: string) {
    const tour = await this.prisma.tour.findUnique({ where: { id: tourId } });
    if (!tour) throw new NotFoundException('Tour not found');

    // Calculate 5% Platform Fee
    const platformFee = tour.price * 0.05;
    const organizerPayout = tour.price - platformFee;

    return this.prisma.booking.create({
      data: {
        userId,
        tourId,
        totalAmount: tour.price,
        platformFee,
        organizerPayout,
        status: 'CONFIRMED', // Mock payment is instantly confirmed
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
}
`);

// 3. CREATE BOOKING CONTROLLER (API Routes)
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
    try {
      req.user = this.jwtService.verify(token);
      return true;
    } catch (e) { return false; }
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
}
`);

// 4. UPDATE APP MODULE (Wire up Booking)
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
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'super_secret_voyagora_key_123',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController],
  providers: [PrismaService, AuthService, TourService, BookingService],
})
export class AppModule {}
`);

// 5. CREATE TRAVELER WALLET PAGE (See booked tickets)
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
    fetch('http://localhost:3000/bookings/mine', {
      headers: { 'Authorization': \`Bearer \${token}\` }
    })
      .then(res => res.json())
      .then(data => setBookings(data));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">My Bookings</h1>
          <button onClick={() => navigate('/')} className="text-indigo-400 hover:text-indigo-300">← Back to Home</button>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-gray-800 p-8 rounded-2xl text-center text-gray-400">
            You haven't booked any tours yet.
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col md:flex-row gap-6">
                <img src={b.tour.imageUrl} alt="" className="w-full md:w-48 h-32 object-cover rounded-xl" />
                <div className="flex-grow">
                  <h3 className="text-2xl font-bold mb-1">{b.tour.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">Booked on: {new Date(b.createdAt).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">{b.status}</span>
                    <span className="text-gray-300">Total Paid: <b>₹{b.totalAmount}</b></span>
                  </div>
                </div>
                <div className="flex md:flex-col items-center justify-center bg-gray-900 p-4 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Booking ID</p>
                  <p className="font-mono text-indigo-400 font-bold">{b.id.slice(0, 8).toUpperCase()}</p>
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

// 6. CREATE MOCK CHECKOUT PAGE (Simulates Stripe)
createFile('apps/web/src/pages/Checkout.tsx', `
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const tour = location.state?.tour;
  const [loading, setLoading] = useState(false);

  if (!tour) {
    navigate('/');
    return null;
  }

  const handlePay = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    // Simulate payment processing delay
    await new Promise(r => setTimeout(r, 1500));

    const res = await fetch('http://localhost:3000/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
      body: JSON.stringify({ tourId: tour.id })
    });

    if (res.ok) {
      navigate('/my-bookings');
    } else {
      alert('Payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-indigo-600 p-6">
          <h2 className="text-2xl font-bold">Checkout</h2>
          <p className="text-indigo-200 text-sm">Secure Payment Gateway</p>
        </div>
        
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <img src={tour.imageUrl} alt="" className="w-24 h-24 object-cover rounded-xl" />
            <div>
              <h3 className="text-xl font-bold">{tour.title}</h3>
              <p className="text-gray-400 text-sm line-clamp-2">{tour.description}</p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400"><span>Base Price</span><span>₹{tour.price}</span></div>
            <div className="flex justify-between text-gray-400"><span>Platform Fee</span><span>₹{tour.price * 0.05}</span></div>
            <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-gray-700 mt-2"><span>Total</span><span>₹{tour.price}</span></div>
          </div>

          <input type="text" placeholder="Card Number" className="w-full p-3 bg-gray-700 rounded-xl outline-none mb-3" defaultValue="4242 4242 4242 4242" />
          <div className="flex gap-3 mb-6">
            <input type="text" placeholder="MM/YY" className="w-1/2 p-3 bg-gray-700 rounded-xl outline-none" defaultValue="12/25" />
            <input type="text" placeholder="CVC" className="w-1/2 p-3 bg-gray-700 rounded-xl outline-none" defaultValue="123" />
          </div>

          <button onClick={handlePay} disabled={loading}
            className="w-full bg-green-600 py-4 rounded-xl font-bold text-lg hover:bg-green-500 transition disabled:opacity-50">
            {loading ? 'Processing Payment...' : \`Pay ₹\${tour.price}\`}
          </button>
          <button onClick={() => navigate(-1)} className="w-full text-center text-gray-500 mt-4 text-sm hover:text-white">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
`);

// 7. UPDATE APP.TSX (Add Routes & Book Now Logic)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';

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
    if (!isLoggedIn) {
      navigate('/login');
    } else {
      navigate('/checkout', { state: { tour } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Voyagora<span className="text-indigo-400">.</span></h1>
        <div className="flex gap-4">
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
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 4 (Bookings & Payments) successfully generated!');
