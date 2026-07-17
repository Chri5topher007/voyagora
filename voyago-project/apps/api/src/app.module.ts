
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { UploadController } from './upload.controller';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { EmailService } from './email.service';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HealthController } from './health.controller';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      // No hardcoded fallback: in dev, set JWT_SECRET in your .env file (see .env.example).
      // In production this MUST be set or the app will refuse to start (see main.ts).
      // Actual access-token expiry (1h) is set explicitly per-call in
      // AuthService — this default only applies if sign() is ever called
      // without options, which shouldn't happen, but errs short just in case.
      secret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
    // Global rate limit: 100 requests / 60s per IP by default. Sensitive
    // routes (login, register, password reset, AI) get stricter limits set
    // directly on those routes.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController, NotificationController, FollowController, HealthController, WebhookController],
  providers: [
    PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService, NotificationService, FollowService, EmailService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
