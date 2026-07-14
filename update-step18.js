const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE API PACKAGE.JSON (Add Stripe SDK)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { start: "node dist/main", build: "tsc -p tsconfig.json" },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/serve-static": "^4.0.0", "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "multer": "^1.4.5-lts.1", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. UPDATE BOOKING SERVICE (Create Stripe Session & Verify Payment)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BookingService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2024-06-20' });
  }

  async createCheckoutSession(userId: string, tourId: string, eventType: string) {
    const item = await this.prisma[eventType].findUnique({ where: { id: tourId } });
    if (!item) throw new NotFoundException('Item not found');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: item.title, description: item.description.substring(0, 100) },
          unit_amount: Math.round(item.price * 100), // Stripe takes paise
        },
        quantity: 1,
      }],
      metadata: { userId, itemId: tourId, itemType: eventType },
      success_url: 'http://localhost:8080/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:8080/checkout/cancel',
    });

    return { url: session.url };
  }

  // This runs after the user pays on Stripe and is redirected back
  async verifyAndSaveBooking(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') throw new BadRequestException('Payment not completed');

    // Check if booking already exists to prevent duplicates
    const existing = await this.prisma.booking.findFirst({ where: { qrCode: sessionId } });
    if (existing) return existing;

    const { userId, itemId, itemType } = session.metadata!;
    const item = await this.prisma[itemType].findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const platformFee = item.price * 0.05;
    const organizerPayout = item.price - platformFee;
    const qrCode = 'VOY-' + sessionId.slice(-12);

    return this.prisma.booking.create({
      data: {
        userId,
        [itemType + 'Id']: itemId,
        totalAmount: item.price,
        platformFee,
        organizerPayout,
        status: 'CONFIRMED',
        qrCode,
      },
    });
  }

  async getMyBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { tour: true, event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyTicket(qrCode: string) {
    const booking = await this.prisma.booking.findFirst({ where: { qrCode } });
    if (!booking) throw new NotFoundException('Invalid Ticket');
    if (booking.isCheckedIn) throw new BadRequestException('Ticket already used');
    await this.prisma.booking.update({ where: { id: booking.id }, data: { isCheckedIn: true } });
    return { success: true, message: 'Check-in successful!' };
  }
}
`);

// 3. UPDATE BOOKING CONTROLLER (New Routes for Stripe)
createFile('apps/api/src/booking.controller.ts', `
import { Controller, Post, Get, Query, Body, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
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

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('checkout')
  async createCheckout(@Request() req: any, @Body() body: { itemId: string, itemType: string }) {
    return this.bookingService.createCheckoutSession(req.user.sub, body.itemId, body.itemType);
  }

  // Public route called by frontend after Stripe redirects back
  @Get('verify')
  async verify(@Query('session_id') sessionId: string) {
    return this.bookingService.verifyAndSaveBooking(sessionId);
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

// 4. UPDATE FRONTEND CHECKOUT PAGE (Redirect to Stripe)
createFile('apps/web/src/pages/Checkout.tsx', `
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const tour = location.state?.tour;
  const event = location.state?.event;
  const item = tour || event;
  const [loading, setLoading] = useState(false);

  if (!item) {
    navigate('/');
    return null;
  }

  const handlePay = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const res = await fetch('http://localhost:3000/bookings/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ itemId: item.id, itemType: tour ? 'tour' : 'event' })
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to real Stripe Checkout
    } else {
      alert('Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-6 text-white">
          <h2 className="text-2xl font-bold">Secure Checkout</h2>
          <p className="text-slate-400 text-sm">Powered by Stripe</p>
        </div>
        
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <img src={item.imageUrl} alt="" className="w-24 h-24 object-cover rounded-xl" />
            <div>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-2">{item.description}</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Base Price</span><span>₹{item.price}</span></div>
            <div className="flex justify-between text-slate-500"><span>Platform Fee (5%)</span><span>₹{item.price * 0.05}</span></div>
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-2"><span>Total</span><span>₹{item.price}</span></div>
          </div>

          <button onClick={handlePay} disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Redirecting to Stripe...' : 'Pay ₹' + item.price + ' Now'}
          </button>
          <button onClick={() => navigate(-1)} className="w-full text-center text-slate-500 mt-4 text-sm hover:text-slate-900">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
`);

// 5. CREATE SUCCESS & CANCEL PAGES
createFile('apps/web/src/pages/CheckoutSuccess.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      await fetch('http://localhost:3000/bookings/verify?session_id=' + sessionId);
      setLoading(false);
    };
    verify();
  }, [sessionId]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Verifying payment...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h1>
        <p className="text-slate-500 mb-8">Your booking is confirmed. Your ticket has been generated.</p>
        <button onClick={() => navigate('/my-bookings')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">View My Tickets</button>
      </motion.div>
    </div>
  );
}
`);

createFile('apps/web/src/pages/CheckoutCancel.tsx', `
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function CheckoutCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✕</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Cancelled</h1>
        <p className="text-slate-500 mb-8">Your payment was not processed. You can try again.</p>
        <button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">Back to Home</button>
      </motion.div>
    </div>
  );
}
`);

// 6. UPDATE APP.TSX (Add Success/Cancel Routes)
createFile('apps/web/src/App.tsx', `
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
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

console.log('\n✨ Step 18 (Real Stripe Integration) successfully generated!');
