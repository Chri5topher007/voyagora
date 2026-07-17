
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NotificationService } from './notification.service';
import Stripe from 'stripe';

@Injectable()
export class BookingService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService, private notificationService: NotificationService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing_configure_env', { apiVersion: '2024-06-20' as any });
  }

  async createCheckoutSession(userId: string, itemId: string, itemType: string, travelDate?: string, couponCode?: string, paymentChoice?: string) {
    // itemType is validated to only ever be 'tour' or 'event' by CreateCheckoutDto
    // before it reaches here, so this dynamic model access is safe.
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
        discountApplied: discountApplied.toString(),
      },
      success_url: frontendUrl + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: frontendUrl + '/checkout/cancel',
    });

    return { url: session.url };
  }

  // Idempotent: safe to call more than once for the same session (browser
  // redirect AND the Stripe webhook both call this) without creating
  // duplicate bookings.
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

  // Only the organizer who owns the tour/event (or an admin) may check a
  // ticket in — previously any logged-in user could check in anyone's ticket.
  async verifyTicket(qrCode: string, requesterId: string, requesterRole: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { qrCode },
      include: { tour: true, event: true },
    });
    if (!booking) throw new NotFoundException('Invalid Ticket');

    const ownerId = booking.tour?.organizerId || booking.event?.organizerId;
    if (requesterRole !== 'ADMIN' && ownerId !== requesterId) {
      throw new ForbiddenException('You do not have permission to check in this ticket');
    }

    if (booking.isCheckedIn) throw new BadRequestException('Ticket already used');
    await this.prisma.booking.update({ where: { id: booking.id }, data: { isCheckedIn: true } });
    return { success: true, message: 'Check-in successful!' };
  }
}
