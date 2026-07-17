const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE API PACKAGE.JSON (Add Nodemailer)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { start: "node dist/main", build: "tsc -p tsconfig.json" },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/serve-static": "^4.0.0", "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "multer": "^1.4.5-lts.1", "nodemailer": "^6.9.13", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "@types/nodemailer": "^6.4.15", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. CREATE EMAIL SERVICE (Handles sending emails or logging to console)
createFile('apps/api/src/email.service.ts', `
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Only configure transporter if SMTP settings are provided in .env
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      console.log('✉️ Email service configured with real SMTP credentials.');
    } else {
      console.log('⚠️ SMTP credentials not found. Emails will be logged to console only.');
    }
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      // Mock sending for local development
      console.log('-----------------------------------');
      console.log('📧 MOCK EMAIL SENT');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Body:', html);
      console.log('-----------------------------------');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: '"Voyagora Ecosystem" <no-reply@voyagora.com>',
        to, subject, html,
      });
    } catch (e) {
      console.error('Failed to send email:', e);
    }
  }
}
`);

// 3. UPDATE NOTIFICATION SERVICE (Fetch Email & Send HTML template)
createFile('apps/api/src/notification.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EmailService } from './email.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService, private emailService: EmailService) {}

  async sendNotification(userId: string, message: string) {
    // 1. Save to Database (For the Bell Icon)
    const notification = await this.prisma.notification.create({
      data: { userId, message },
    });

    // 2. Fetch User Email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      // 3. Send HTML Email
      const html = \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 12px;">
          <div style="background: #0f172a; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #6366f1; margin: 0;">Voyagora</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; text-align: center;">
            <h2 style="color: #0f172a; margin-top: 0;">🔔 New Notification</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">\${message}</p>
            <a href="http://localhost:8080" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">View on Voyagora</a>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">© 2024 Voyagora Ecosystem. All rights reserved.</p>
        </div>
      \`;
      
      await this.emailService.sendEmail(user.email, 'Voyagora Update: ' + message, html);
    }

    return notification;
  }

  async getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async markAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
`);

// 4. UPDATE APP MODULE (Wire up EmailService)
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
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { EmailService } from './email.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController, ReviewController, WishlistController, AdminController, UserController, NotificationController, FollowController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService, ReviewService, WishlistService, AdminService, UserService, NotificationService, FollowService, EmailService],
})
export class AppModule {}
`);

console.log('\n✨ Step 40 (Real Email Notifications) successfully generated!');
