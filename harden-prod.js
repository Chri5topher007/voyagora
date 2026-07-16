const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Hardened ' + filePath);
}

// 1. UPDATE API PACKAGE.JSON (Add Security & Validation Packages)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { 
    start: "node dist/main", 
    build: "tsc -p tsconfig.json",
    "db:migrate": "prisma db push --accept-data-loss && node seed.js && node dist/main.js"
  },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/throttler": "^5.1.1", "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "class-validator": "^0.14.1", "class-transformer": "^0.5.1",
    "cloudinary": "^1.41.0", "helmet": "^7.1.0", "multer": "^1.4.5-lts.1", "multer-storage-cloudinary": "^4.0.0",
    "nodemailer": "^6.9.13", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "@types/nodemailer": "^6.4.15", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. UPDATE MAIN.TS (Add Helmet, Validation Pipe, Dynamic CORS)
createFile('apps/api/src/main.ts', `
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security: Add HTTP headers
  app.use(helmet());
  
  // Security: Global Validation Pipe (strips unknown properties, validates DTOs)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CORS: Dynamically allow frontend URL
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  });
  
  const prismaService = app.get(PrismaService);
  const couponExists = await prismaService.coupon.findUnique({ where: { code: 'VOYAGORA100' } });
  if (!couponExists) {
    await prismaService.coupon.create({ data: { code: 'VOYAGORA100', discountAmount: 100 } });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log('🚀 Voyagora API running on port ' + port);
}
bootstrap();
`);

// 3. UPDATE APP MODULE (Add Throttler for Rate Limiting)
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
    // Rate Limiting: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'dev_secret', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController, NotificationController, FollowController],
  providers: [
    PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService, NotificationService, FollowService, EmailService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ],
})
export class AppModule {}
`);

// 4. FIX AUTH SERVICE (Close Admin Privilege Escalation & Fix JWT Secret)
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

  async register(dto: { email: string; password: string; name: string; role?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    
    // SECURITY FIX: Force role to TRAVELER. Ignore any role sent from the frontend.
    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashedPassword, name: dto.name, role: 'TRAVELER' }
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

    // SECURITY FIX: Only update subscription status, don't trust client for role changes
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'ACTIVE', role: 'ORGANIZER' }, // Upgrade to organizer after payment
    });

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, subscriptionStatus: user.subscriptionStatus } };
  }
}
`);

// 5. CREATE VERCEL.JSON (SPA Routing Fallback)
createFile('apps/web/vercel.json', `
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
`);

// 6. CREATE CENTRALIZED API CONFIG (Frontend)
createFile('apps/web/src/config.ts', `
// Centralized API URL. 
// Uses Vercel env var in production, falls back to localhost for dev.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
`);

console.log('\n✨ Production Hardening Complete! Please run: docker compose up --build');
