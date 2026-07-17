
import { Controller, Post, Get, Query, Body, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import { CreateCheckoutDto, VerifyTicketDto } from './common/dto/booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckout(@Request() req: any, @Body() body: CreateCheckoutDto) {
    // NOTE: previously `paymentChoice` was silently dropped here, so anyone
    // who selected "pay advance" in the UI was still charged the full amount.
    return this.bookingService.createCheckoutSession(
      req.user.sub, body.itemId, body.itemType, body.travelDate, body.couponCode, body.paymentChoice,
    );
  }

  @Get('verify')
  async verify(@Query('session_id') sessionId: string) {
    return this.bookingService.verifyAndSaveBooking(sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async getMyBookings(@Request() req: any) {
    return this.bookingService.getMyBookings(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post('verify')
  async verifyTicket(@Request() req: any, @Body() body: VerifyTicketDto) {
    return this.bookingService.verifyTicket(body.qrCode, req.user.sub, req.user.role);
  }
}
