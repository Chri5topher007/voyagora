const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add Profile Image & Bio to User)
createFile('apps/api/prisma/schema.prisma', `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
generator client {
  provider = "prisma-client-js"
}
model User {
  id                 String   @id @default(uuid())
  email              String   @unique
  password           String
  name               String
  role               String   @default("TRAVELER")
  subscriptionStatus String   @default("INACTIVE")
  profileImageUrl    String?
  bio                String?
  tours              Tour[]
  events             Event[]
  bookings           Booking[]
  places             CommunityPlace[]
  reviews            Review[]
  wishlist           Wishlist[]
  createdAt          DateTime @default(now())
}
model Tour {
  id              String   @id @default(uuid())
  title           String
  description     String
  price           Float
  imageUrl        String
  lat             Float    @default(0)
  lng             Float    @default(0)
  organizerId     String
  organizer       User     @relation(fields: [organizerId], references: [id])
  bookings        Booking[]
  reviews         Review[]
  wishlist        Wishlist[]
  paymentType     String   @default("FULL")
  advanceAmount   Float    @default(0)
  gstNumber       String?
  gstPercentage   Float    @default(0)
  createdAt       DateTime @default(now())
}
model Event {
  id              String   @id @default(uuid())
  title           String
  description     String
  price           Float
  imageUrl        String
  lat             Float    @default(0)
  lng             Float    @default(0)
  eventDate       DateTime
  organizerId     String
  organizer       User     @relation(fields: [organizerId], references: [id])
  bookings        Booking[]
  reviews         Review[]
  wishlist        Wishlist[]
  paymentType     String   @default("FULL")
  advanceAmount   Float    @default(0)
  gstNumber       String?
  gstPercentage   Float    @default(0)
  createdAt       DateTime @default(now())
}
model Booking {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  tourId          String?
  tour            Tour?    @relation(fields: [tourId], references: [id])
  eventId         String?
  event           Event?   @relation(fields: [eventId], references: [id])
  totalAmount     Float
  amountPaid      Float
  pendingAmount   Float
  platformFee     Float
  organizerPayout Float
  gstAmount       Float
  status          String   @default("CONFIRMED")
  qrCode          String   @unique
  isCheckedIn     Boolean  @default(false)
  travelDate      DateTime?
  createdAt       DateTime @default(now())
}
model CommunityPlace {
  id          String   @id @default(uuid())
  name        String
  description String
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  status      String   @default("PENDING")
  uploadedBy  String
  user        User     @relation(fields: [uploadedBy], references: [id])
  createdAt   DateTime @default(now())
}
model Review {
  id        String   @id @default(uuid())
  rating    Int
  comment   String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tourId    String?
  tour      Tour?    @relation(fields: [tourId], references: [id])
  eventId   String?
  event     Event?   @relation(fields: [eventId], references: [id])
  createdAt DateTime @default(now())
}
model Wishlist {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tourId    String?
  tour      Tour?    @relation(fields: [tourId], references: [id])
  eventId   String?
  event     Event?   @relation(fields: [eventId], references: [id])
  createdAt DateTime @default(now())
}
`);

// 2. CREATE USER SERVICE
createFile('apps/api/src/user.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getMe(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, profileImageUrl: true, bio: true, subscriptionStatus: true }
    });
  }

  async updateMe(id: string, dto: { name: string; bio: string; profileImageUrl: string }) {
    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, bio: dto.bio, profileImageUrl: dto.profileImageUrl },
      select: { id: true, name: true, email: true, role: true, profileImageUrl: true, bio: true, subscriptionStatus: true }
    });
  }
}
`);

// 3. CREATE USER CONTROLLER
createFile('apps/api/src/user.controller.ts', `
import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; }
  }
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('me')
  async getMe(@Request() req: any) { return this.userService.getMe(req.user.sub); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Patch('me')
  async updateMe(@Request() req: any, @Body() body: any) { return this.userService.updateMe(req.user.sub, body); }
}
`);

// 4. UPDATE APP MODULE
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
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
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService],
})
export class AppModule {}
`);

console.log('\n✨ Step 29a (Backend Profile) successfully generated!');
