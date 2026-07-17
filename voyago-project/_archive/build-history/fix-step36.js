const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FIX BOOKING SERVICE (Cast prisma.coupon to any)
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

  async createCheckoutSession(userId: string, itemId: string, itemType: string, travelDate?: string, couponCode?: string) {
    const item = await (this.prisma as any)[itemType].findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const basePrice = item.price;
    const gstAmount = (basePrice * (item.gstPercentage || 0)) / 100;
    let amountToPayOnline = basePrice + gstAmount;
    if (item.paymentType === 'ADVANCE') {
      amountToPayOnline = (item.advanceAmount || 0) + gstAmount;
    }
    
    let discountApplied = 0;
    if (couponCode) {
      const coupon = await (this.prisma as any).coupon.findFirst({ where: { code: couponCode, isActive: true } });
      if (!coupon) throw new BadRequestException('Invalid Promo Code');
      discountApplied = coupon.discountAmount;
      amountToPayOnline = Math.max(0, amountToPayOnline - discountApplied);
    }

    const pendingAmount = (basePrice + gstAmount) - amountToPayOnline - (item.paymentType === 'ADVANCE' ? (item.advanceAmount || 0) : 0);
    const platformFee = amountToPayOnline * 0.05;
    const organizerPayout = amountToPayOnline - platformFee;

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: { name: item.title + (item.paymentType === 'ADVANCE' ? ' (Advance Booking)' : ''), description: item.description.substring(0, 100) },
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
      success_url: 'http://localhost:8080/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:8080/checkout/cancel',
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

    // Send Notifications
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

// 2. FIX MAIN.TS (Cast prismaService.coupon to any)
createFile('apps/api/src/main.ts', `
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  
  const prismaService = app.get(PrismaService);
  
  // Seed default coupon
  const couponExists = await (prismaService as any).coupon.findUnique({ where: { code: 'VOYAGORA100' } });
  if (!couponExists) {
    await (prismaService as any).coupon.create({ data: { code: 'VOYAGORA100', discountAmount: 100 } });
    console.log('🎟️ Default coupon VOYAGORA100 created!');
  }

  await app.listen(3000);
  console.log('🚀 Voyagora API running on http://localhost:3000');
}
bootstrap();
`);

console.log('\n✨ Step 36 (TypeScript Coupon Fix) successfully patched!');
