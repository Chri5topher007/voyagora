
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
