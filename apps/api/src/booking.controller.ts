
import { Controller, Post, Get, Query, Body, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
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

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService, private jwtService: JwtService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('checkout')
  async createCheckout(@Request() req: any, @Body() body: { itemId: string, itemType: string, travelDate?: string, couponCode?: string }) {
    return this.bookingService.createCheckoutSession(req.user.sub, body.itemId, body.itemType, body.travelDate, body.couponCode);
  }

  @Get('verify')
  async verify(@Query('session_id') sessionId: string) {
    return this.bookingService.verifyAndSaveBooking(sessionId);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('mine')
  async getMyBookings(@Request() req: any) {
    return this.bookingService.getMyBookings(req.user.sub);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('verify')
  async verifyTicket(@Body() body: { qrCode: string }) {
    return this.bookingService.verifyTicket(body.qrCode);
  }
}
