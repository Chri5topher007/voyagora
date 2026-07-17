import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth.service';
import { BookingService } from './booking.service';

// Why this exists: previously, a booking or subscription was only ever
// confirmed when the customer's browser successfully redirected back to
// /checkout/success and called /bookings/verify or /auth/verify-subscription.
// If they closed the tab, lost signal, or the browser crashed right after
// paying, Stripe had their money and Voyagora had no record of it. This
// webhook is the reliable, browser-independent source of truth: Stripe
// calls it directly, server-to-server, the moment a payment completes.
@Controller('webhooks')
export class WebhookController {
  private stripe: Stripe;
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private bookingService: BookingService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing_configure_env', { apiVersion: '2024-06-20' as any });
  }

  @Post('stripe')
  async handleStripeWebhook(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // Fail loudly in logs rather than silently skipping verification —
      // an unverified webhook endpoint would let anyone forge "payment
      // completed" events.
      throw new BadRequestException('Webhook not configured');
    }

    let event: Stripe.Event;
    try {
      // req.rawBody is populated by NestFactory.create(AppModule, { rawBody: true })
      event = this.stripe.webhooks.constructEvent((req as any).rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // Idempotency: Stripe may deliver the same event more than once.
    const already = await this.prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
    if (already) return { received: true, alreadyProcessed: true };

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      try {
        if (session.metadata?.tier) {
          await this.authService.verifyAndActivate(session.id);
        } else if (session.metadata?.itemId) {
          await this.bookingService.verifyAndSaveBooking(session.id);
        }
      } catch (err) {
        // Log and swallow: verifyAndSaveBooking/verifyAndActivate are
        // idempotent, so if this failed we want Stripe to retry the
        // webhook rather than us throwing and losing the event.
        console.error('Webhook processing error', err);
        throw err;
      }
    }

    await this.prisma.processedStripeEvent.create({ data: { id: event.id } });
    return { received: true };
  }
}
