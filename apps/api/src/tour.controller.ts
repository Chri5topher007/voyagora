
import { Controller, Post, Get, Param, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { TourService } from './tour.service';
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

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService, private jwtService: JwtService) {}

  @Get()
  async getAllTours(@Query() query: { search?: string; maxPrice?: string }) { 
    return this.tourService.getAllTours(query); 
  }

  @Get(':id')
  async getTourById(@Param('id') id: string) {
    return this.tourService.getTourById(id);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async createTour(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create tours');
    return this.tourService.createTour(req.user.sub, body);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.tourService.getOrganizerStats(req.user.sub);
  }
}
