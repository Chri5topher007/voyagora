
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EmailService } from './email.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { generateOpaqueToken, hashToken } from './common/utils/token.util';

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL_DAYS = 30;
const RESET_TOKEN_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  private stripe: Stripe;
  constructor(private prisma: PrismaService, private jwtService: JwtService, private emailService: EmailService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_missing_configure_env', { apiVersion: '2024-06-20' as any });
  }

  private publicUser(user: any) {
    return { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus };
  }

  // Issues a short-lived access token (1h) plus a long-lived, revocable
  // refresh token. Only the HASH of the refresh token is stored, so a
  // database leak can't be used to mint new sessions.
  private async issueTokenPair(user: any) {
    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn: ACCESS_TOKEN_TTL });
    const rawRefreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { token: hashToken(rawRefreshToken), userId: user.id, expiresAt },
    });
    return { accessToken, refreshToken: rawRefreshToken, user: this.publicUser(user) };
  }

  async register(dto: { email: string; password: string; name: string; role: string }) {
    const email = (dto.email || '').trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword, name: dto.name.trim(), role: dto.role },
    });

    return this.issueTokenPair(user);
  }

  async login(dto: { email: string; password: string }) {
    const email = (dto.email || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokenPair(user);
  }

  // Exchanges a valid, unexpired, unrevoked refresh token for a new access
  // token. Rotates the refresh token on every use (old one is revoked,
  // a new one issued) so a stolen-but-unused old token becomes useless.
  async refreshAccessToken(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired, please log in again');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw new UnauthorizedException('Session expired, please log in again');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokenPair(user);
  }

  async logout(rawRefreshToken: string) {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { token: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // Always returns the same generic response whether or not the email
  // exists, so this endpoint can't be used to enumerate registered users.
  async forgotPassword(email: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const rawToken = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      await this.prisma.passwordResetToken.create({
        data: { token: hashToken(rawToken), userId: user.id, expiresAt },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 12px;">
          <div style="background: #0f172a; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #6366f1; margin: 0;">Voyagora</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; text-align: center;">
            <h2 style="color: #0f172a; margin-top: 0;">Reset your password</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Click below to reset your password. This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
            <a href="${resetLink}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Reset Password</a>
          </div>
        </div>
      `;
      await this.emailService.sendEmail(user.email, 'Reset your Voyagora password', html);
    }

    return { message: 'If an account exists for that email, a reset link has been sent.' };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { password: hashedPassword } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    return { message: 'Password updated. Please log in again.' };
  }

  async createSubscriptionCheckout(userId: string, tier: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const priceMap: any = {
      STARTER: { amount: 50000, name: 'Starter Plan' },
      PROFESSIONAL: { amount: 100000, name: 'Professional Plan' },
      ENTERPRISE: { amount: 199900, name: 'Enterprise Plan' },
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

  // Idempotent: safe to call more than once for the same session (both from
  // the browser redirect AND from the Stripe webhook) without double-applying.
  async verifyAndActivate(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') throw new BadRequestException('Payment not completed');

    const userId = session.metadata?.userId;
    if (!userId) throw new BadRequestException('Invalid session');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (user.subscriptionStatus !== 'ACTIVE') {
      await this.prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'ACTIVE' } });
    }

    const updated = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.issueTokenPair(updated);
  }
}
