
import { Controller, Post, Get, Delete, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }

@Controller('events')
export class EventController {
  constructor(private readonly es: EventService, private jwtService: JwtService) {}
  @Get() async getAll() { return this.es.getAllEvents(); }
  @Get(':id') async getEventById(@Param('id') id: string) { return this.es.getEventById(id); }
  
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post() async create(@Request() req: any, @Body() body: any) { if (req.user.role !== 'ORGANIZER') throw new ForbiddenException('Only organizers can create events'); return this.es.createEvent(req.user.sub, body); }
  
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Delete(':id') async delete(@Request() req: any, @Param('id') id: string) { return this.es.deleteEvent(id, req.user.sub); }
}
