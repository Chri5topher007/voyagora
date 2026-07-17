const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE AUTH SERVICE (Add real Stripe Subscription logic)
createFile('apps/api/src/auth.service.ts', `
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import Stripe from 'stripe';

@Injectable()
export class AuthService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService, private jwtService: JwtService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2024-06-20' as any });
  }

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

  // Create real Stripe Checkout Session for Subscription
  async createSubscriptionCheckout(userId: string, tier: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // In production, you would map these to real Stripe Price IDs from your dashboard
    // For testing, we use dynamic price_data so you don't have to configure products in Stripe
    const priceMap: any = {
      STARTER: { amount: 99900, name: 'Starter Plan' }, // ₹999 in paise
      PROFESSIONAL: { amount: 299900, name: 'Professional Plan' }, // ₹2999
      ENTERPRISE: { amount: 999900, name: 'Enterprise Plan' } // ₹9999
    };

    const selectedPlan = priceMap[tier] || priceMap.STARTER;

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment', // Using one-time payment for MVP. For true recurring, you'd use mode: 'subscription' and Stripe Price IDs
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: selectedPlan.name + ' (1 Month)' },
          unit_amount: selectedPlan.amount,
        },
        quantity: 1,
      }],
      metadata: { userId, tier },
      success_url: process.env.FRONTEND_URL + '/auth/activate-subscription?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: process.env.FRONTEND_URL + '/pricing',
    });

    return { url: session.url };
  }

  // Verify Stripe Payment and Activate Subscription
  async verifyAndActivate(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') throw new BadRequestException('Payment not completed');

    const userId = session.metadata?.userId;
    if (!userId) throw new BadRequestException('Invalid session');

    // Activate subscription for 1 month
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1);

    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        subscriptionStatus: 'ACTIVE',
      },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus } };
  }
}
`);

// 2. UPDATE AUTH CONTROLLER (Add Checkout & Verify Routes)
createFile('apps/api/src/auth.controller.ts', `
import { Controller, Post, Get, Query, Body, UseGuards, Request } from '@nestjs/common';
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

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post('create-subscription-checkout')
  createCheckout(@Request() req: any, @Body() body: { tier: string }) {
    return this.authService.createSubscriptionCheckout(req.user.sub, body.tier);
  }

  @Get('verify-subscription')
  verifySubscription(@Query('session_id') sessionId: string) {
    return this.authService.verifyAndActivate(sessionId);
  }
}
`);

// 3. UPGRADE PRICING PAGE (Redirect to real Stripe)
createFile('apps/web/src/pages/Pricing.tsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Pricing() {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: string) => {
    setLoadingTier(tier);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    try {
      const res = await fetch('http://localhost:3000/auth/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ tier })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to real Stripe Checkout
      } else {
        alert(data.message || 'Failed to initiate subscription payment');
        setLoadingTier(null);
      }
    } catch (err) {
      alert('Network error. Is the backend running?');
      setLoadingTier(null);
    }
  };

  const plans = [
    { id: 'STARTER', name: 'Starter', price: '₹999', features: ['Up to 5 Active Listings', 'Basic Analytics', 'Standard Support'] },
    { id: 'PROFESSIONAL', name: 'Professional', price: '₹2,999', features: ['Unlimited Listings', 'Advanced Heat Maps', 'Featured Listings (2/mo)', 'Priority Support'], popular: true },
    { id: 'ENTERPRISE', name: 'Enterprise', price: '₹9,999', features: ['Everything in Pro', 'API Access', 'Dedicated Account Manager', 'Custom Integrations'] }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Choose Your Plan</h1>
        <p className="text-slate-500">Unlock your organizer dashboard and start selling today. Secure payment via Stripe.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl w-full">
        {plans.map((plan, i) => (
          <motion.div 
            key={plan.id} 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={"bg-white p-8 rounded-2xl shadow-sm border flex flex-col " + (plan.popular ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-slate-200')}
          >
            {plan.popular && <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-semibold self-start mb-4">MOST POPULAR</span>}
            <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
            <p className="text-4xl font-extrabold mb-6">{plan.price}<span className="text-base font-normal text-slate-500">/mo</span></p>
            <ul className="space-y-3 mb-8 text-sm flex-grow">
              {plan.features.map(f => <li key={f} className="text-slate-600 flex items-center gap-2"><span className="text-green-500">✓</span> {f}</li>)}
            </ul>
            <button 
              onClick={() => handleSubscribe(plan.id)} 
              disabled={loadingTier !== null}
              className={"w-full py-3 rounded-xl font-bold text-sm transition mt-auto disabled:opacity-50 " + (plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')}
            >
              {loadingTier === plan.id ? 'Redirecting to Stripe...' : 'Subscribe & Pay'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
`);

// 4. CREATE SUBSCRIPTION SUCCESS PAGE (Handles Stripe Redirect)
createFile('apps/web/src/pages/SubscriptionSuccess.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('http://localhost:3000/auth/verify-subscription?session_id=' + sessionId);
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('role', data.user.role);
          localStorage.setItem('subStatus', data.user.subscriptionStatus);
          setLoading(false);
        } else {
          setError(data.message || 'Verification failed');
          setLoading(false);
        }
      } catch (err) {
        setError('Network error during verification');
        setLoading(false);
      }
    };
    verify();
  }, [sessionId]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Verifying your subscription payment...</div>;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✕</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h1>
          <p className="text-slate-500 mb-8">{error}</p>
          <button onClick={() => navigate('/pricing')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">Back to Pricing</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Subscription Active!</h1>
        <p className="text-slate-500 mb-8">Your payment was successful. Your Organizer Dashboard is now unlocked.</p>
        <button onClick={() => navigate('/dashboard')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">Go to Dashboard</button>
      </motion.div>
    </div>
  );
}
`);

console.log('\n✨ Step 45 (Real Organizer Stripe Subscriptions) successfully generated!');
