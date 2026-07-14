
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
