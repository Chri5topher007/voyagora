const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE AUTH SERVICE (New Stripe Amounts)
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

  async createSubscriptionCheckout(userId: string, tier: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    // Updated Prices: 500, 1000, 1999 (Amounts in paise)
    const priceMap: any = {
      STARTER: { amount: 50000, name: 'Starter Plan' }, 
      PROFESSIONAL: { amount: 100000, name: 'Professional Plan' }, 
      ENTERPRISE: { amount: 199900, name: 'Enterprise Plan' }
    };

    const selectedPlan = priceMap[tier] || priceMap.STARTER;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: selectedPlan.name + ' (1 Month)' },
          unit_amount: selectedPlan.amount,
        },
        quantity: 1,
      }],
      metadata: { userId, tier },
      success_url: frontendUrl + '/auth/activate-subscription?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: frontendUrl + '/pricing',
    });

    return { url: session.url };
  }

  async verifyAndActivate(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') throw new BadRequestException('Payment not completed');

    const userId = session.metadata?.userId;
    if (!userId) throw new BadRequestException('Invalid session');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'ACTIVE' },
    });

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus } };
  }
}
`);

// 2. UPDATE PRICING PAGE UI (New Plans & Features)
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
        window.location.href = data.url;
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
    { id: 'STARTER', name: 'Starter', price: '₹500', features: ['Up to 5 Active Listings', 'Basic Analytics', 'Standard Support'] },
    { id: 'PROFESSIONAL', name: 'Professional', price: '₹1,000', features: ['Up to 20 Active Listings', 'Advanced Heat Maps', 'Featured Listings (2/mo)', 'Priority Support'], popular: true },
    { id: 'ENTERPRISE', name: 'Enterprise', price: '₹1,999', features: ['Up to 35 Active Listings', 'API Access', 'Dedicated Account Manager', 'Custom Integrations'] }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif font-extrabold text-slate-900 mb-2">Choose Your Plan</h1>
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
            <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">{plan.name}</h3>
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

console.log('\n✨ Pricing Updated (500, 1000, 1999) successfully!');
