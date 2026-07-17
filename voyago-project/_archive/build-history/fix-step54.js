const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FIX PACKAGE.JSON (Restore all necessary NestJS packages)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { 
    start: "node dist/main", 
    build: "tsc -p tsconfig.json",
    "db:migrate": "prisma db push --accept-data-loss && node dist/main.js"
  },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "cloudinary": "^1.41.0", "multer": "^1.4.5-lts.1", "multer-storage-cloudinary": "^4.0.0",
    "nodemailer": "^6.9.13", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "@types/nodemailer": "^6.4.15", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. CLEAN UP APP MODULE (Remove local static serving since we use Cloudinary now)
createFile('apps/api/src/app.module.ts', `
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

@Module({
  imports: [
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController, NotificationController, FollowController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService, NotificationService, FollowService, EmailService],
})
export class AppModule {}
`);

console.log('\n✨ Step 54 (Restore Packages & Clean Module) successfully patched!');
