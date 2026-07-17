
import { Controller, Post, Get, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { TourService } from './tour.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import { CreateTourDto, GetToursQueryDto } from './common/dto/listing.dto';

@Controller('tours')
export class TourController {
  constructor(private readonly tourService: TourService) {}

  // NOTE: 'stats' must be declared before ':id' — Nest/Express match routes
  // in registration order, so a param route declared first would swallow
  // the literal 'stats' path (this was a real bug: /tours/stats previously
  // resolved to getTourById('stats') and 404'd, breaking organizer analytics).
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.tourService.getOrganizerStats(req.user.sub);
  }

  @Get()
  async getAllTours(@Query() query: GetToursQueryDto) {
    return this.tourService.getAllTours(query);
  }

  @Get(':id')
  async getTourById(@Param('id') id: string) {
    return this.tourService.getTourById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Post()
  async createTour(@Request() req: any, @Body() body: CreateTourDto) {
    return this.tourService.createTour(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteTour(@Request() req: any, @Param('id') id: string) {
    return this.tourService.deleteTour(id, req.user.sub);
  }
}
