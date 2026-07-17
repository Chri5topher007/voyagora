const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE BOOKING SERVICE (Fix Stripe URL & Accept Payment Choice)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import Stripe from 'stripe';

@Injectable()
export class BookingService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2024-06-20' as any });
  }

  async createCheckoutSession(userId: string, itemId: string, itemType: string, travelDate?: string, couponCode?: string, paymentChoice?: string) {
    const item = await (this.prisma as any)[itemType].findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const basePrice = item.price;
    const gstAmount = (basePrice * (item.gstPercentage || 0)) / 100;
    
    let amountToPayOnline = basePrice + gstAmount; // Default to FULL
    if (item.paymentType === 'ADVANCE' && paymentChoice === 'ADVANCE') {
      amountToPayOnline = (item.advanceAmount || 0) + gstAmount;
    }
    
    let discountApplied = 0;
    if (couponCode) {
      const coupon = await (this.prisma as any).coupon.findFirst({ where: { code: couponCode, isActive: true } });
      if (!coupon) throw new BadRequestException('Invalid Promo Code');
      discountApplied = coupon.discountAmount;
      amountToPayOnline = Math.max(0, amountToPayOnline - discountApplied);
    }

    const pendingAmount = (basePrice + gstAmount) - amountToPayOnline;
    const platformFee = amountToPayOnline * 0.05;
    const organizerPayout = amountToPayOnline - platformFee;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: item.title + (paymentChoice === 'ADVANCE' ? ' (Advance Booking)' : ''), description: item.description.substring(0, 100) },
          unit_amount: Math.round(amountToPayOnline * 100),
        },
        quantity: 1,
      }],
      metadata: { 
        userId, itemId, itemType, travelDate: travelDate || '',
        totalAmount: basePrice.toString(),
        amountPaid: amountToPayOnline.toString(),
        pendingAmount: pendingAmount.toString(),
        platformFee: platformFee.toString(),
        organizerPayout: organizerPayout.toString(),
        gstAmount: gstAmount.toString(),
        discountApplied: discountApplied.toString()
      },
      success_url: frontendUrl + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: frontendUrl + '/checkout/cancel',
    });

    return { url: session.url };
  }

  async verifyAndSaveBooking(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') throw new BadRequestException('Payment not completed');

    const existing = await this.prisma.booking.findFirst({ where: { qrCode: sessionId } });
    if (existing) return existing;

    const meta = session.metadata!;
    const item = await (this.prisma as any)[meta.itemType].findUnique({ where: { id: meta.itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const qrCode = 'VOY-' + sessionId.slice(-12);

    const booking = await this.prisma.booking.create({
      data: {
        userId: meta.userId,
        [meta.itemType + 'Id']: meta.itemId,
        totalAmount: Number(meta.totalAmount),
        amountPaid: Number(meta.amountPaid),
        pendingAmount: Number(meta.pendingAmount),
        platformFee: Number(meta.platformFee),
        organizerPayout: Number(meta.organizerPayout),
        gstAmount: Number(meta.gstAmount),
        discountApplied: Number(meta.discountApplied),
        status: 'CONFIRMED',
        qrCode,
        travelDate: meta.travelDate ? new Date(meta.travelDate) : null,
      },
    });

    await this.notificationService.sendNotification(meta.userId, '🎉 Your booking for ' + item.title + ' is confirmed!');
    await this.notificationService.sendNotification(item.organizerId, '💰 New booking received for ' + item.title + '!');

    return booking;
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

// 2. UPDATE AUTH SERVICE (Fix Stripe URL for Subscriptions)
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

    const priceMap: any = {
      STARTER: { amount: 99900, name: 'Starter Plan' }, 
      PROFESSIONAL: { amount: 299900, name: 'Professional Plan' }, 
      ENTERPRISE: { amount: 999900, name: 'Enterprise Plan' }
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

// 3. UPDATE CHECKOUT PAGE (Add Payment Choice UI)
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
  const [travelDate, setTravelDate] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
  // Payment Choice State: Default to FULL, or ADVANCE if the organizer only allows advance
  const [paymentChoice, setPaymentChoice] = useState(item?.paymentType === 'ADVANCE' ? 'ADVANCE' : 'FULL');

  if (!item) { navigate('/'); return null; }

  const allowsAdvance = item.paymentType === 'ADVANCE';
  const basePrice = item.price;
  const gst = (basePrice * (item.gstPercentage || 0)) / 100;
  
  // Calculate amount based on user's choice
  let amountPayableNow = paymentChoice === 'ADVANCE' ? (item.advanceAmount + gst) : (basePrice + gst);
  
  if (appliedDiscount > 0) {
    amountPayableNow = Math.max(0, amountPayableNow - appliedDiscount);
  }
  
  const pendingAmount = paymentChoice === 'ADVANCE' ? (basePrice + gst) - amountPayableNow - (item.advanceAmount || 0) : 0;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.toUpperCase() === 'VOYAGORA100') {
      setAppliedDiscount(100);
      alert('Promo code applied! ₹100 off');
    } else {
      setAppliedDiscount(0);
      alert('Invalid promo code.');
    }
  };

  const handlePay = async () => {
    if (tour && !travelDate) { alert('Please select a travel date'); return; }
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    const res = await fetch('http://localhost:3000/bookings/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ 
        itemId: item.id, 
        itemType: tour ? 'tour' : 'event', 
        travelDate,
        couponCode: appliedDiscount > 0 ? promoCode.toUpperCase() : undefined,
        paymentChoice // Send the user's choice to the backend
      })
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; } 
    else { alert(data.message || 'Failed to initiate payment'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
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

          {tour && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Travel Date</label>
              <input type="date" required value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
            </div>
          )}

          {/* PAYMENT CHOICE UI */}
          {allowsAdvance && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Option</label>
              <div className="flex gap-4">
                <button type="button" onClick={() => setPaymentChoice('FULL')} className={"flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition " + (paymentChoice === 'FULL' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-200 text-slate-600')}>
                  Pay Full<br/><span className="text-xs font-normal">₹{basePrice + gst}</span>
                </button>
                <button type="button" onClick={() => setPaymentChoice('ADVANCE')} className={"flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition " + (paymentChoice === 'ADVANCE' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-200 text-slate-600')}>
                  Pay Advance<br/><span className="text-xs font-normal">₹{item.advanceAmount + gst}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleApplyPromo} className="flex gap-2 mb-6">
            <input type="text" placeholder="Promo Code (VOYAGORA100)" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="flex-grow p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm uppercase" />
            <button type="submit" className="bg-slate-200 text-slate-800 px-4 rounded-xl text-sm font-semibold hover:bg-slate-300">Apply</button>
          </form>

          <div className="border-t border-slate-200 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Base Price</span><span>₹{basePrice}</span></div>
            {item.gstPercentage > 0 && <div className="flex justify-between text-slate-500"><span>GST ({item.gstPercentage}%)</span><span>₹{gst}</span></div>}
            {appliedDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- ₹{appliedDiscount}</span></div>}
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-2">
              <span>Payable Now</span><span>₹{amountPayableNow}</span>
            </div>
            {paymentChoice === 'ADVANCE' && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                ⚠️ <b>Pending Amount: ₹{basePrice + gst - amountPayableNow}</b><br/>This remaining amount must be paid directly to the organizer upon arrival.
              </div>
            )}
          </div>

          <button onClick={handlePay} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Redirecting to Stripe...' : 'Pay ₹' + amountPayableNow + ' Now'}
          </button>
          <button onClick={() => navigate(-1)} className="w-full text-center text-slate-500 mt-4 text-sm hover:text-slate-900">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
`);

console.log('\n✨ Checkout Updated (Fixed Stripe URLs & Added Payment Choice) successfully!');
