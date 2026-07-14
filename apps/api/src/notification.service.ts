
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
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px; border-radius: 12px;">
          <div style="background: #0f172a; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #6366f1; margin: 0;">Voyagora</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; text-align: center;">
            <h2 style="color: #0f172a; margin-top: 0;">🔔 New Notification</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">${message}</p>
            <a href="http://localhost:8080" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">View on Voyagora</a>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">© 2024 Voyagora Ecosystem. All rights reserved.</p>
        </div>
      `;
      
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
