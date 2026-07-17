
import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import { CreateEventDto } from './common/dto/listing.dto';

@Controller('events')
export class EventController {
  constructor(private readonly es: EventService) {}

  @Get()
  async getAll() {
    return this.es.getAllEvents();
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return this.es.getEventById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER')
  @Post()
  async create(@Request() req: any, @Body() body: CreateEventDto) {
    return this.es.createEvent(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.es.deleteEvent(id, req.user.sub);
  }
}
