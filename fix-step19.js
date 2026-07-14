const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// FIX BOOKING SERVICE (Bypass TS strictness for Stripe & Prisma)
createFile('apps/api/src/booking.service.ts', `
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BookingService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService) {
    // Cast to any to bypass strict API version typing
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', { apiVersion: '2024-06-20' as any });
  }

  async createCheckoutSession(userId: string, tourId: string, eventType: string) {
    // Cast prisma to any to allow dynamic model access
    const item = await (this.prisma as any)[eventType].findUnique({ where: { id: tourId } });
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
    const item = await (this.prisma as any)[itemType].findUnique({ where: { id: itemId } });
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

console.log('\n✨ Step 19 (TypeScript Stripe Fix) successfully patched!');
