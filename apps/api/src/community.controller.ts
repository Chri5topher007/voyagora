
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }

@Controller('community')
export class CommunityController {
  constructor(private readonly cs: CommunityService, private jwtService: JwtService) {}

  @Get() async getApproved() { return this.cs.getApprovedPlaces(); }
  @Get(':id') async getPlaceById(@Param('id') id: string) { return this.cs.getPlaceById(id); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Post() async submit(@Request() req: any, @Body() body: any) { return this.cs.submitPlace(req.user.sub, body); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Get('pending') async getPending(@Request() req: any) { if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only'); return this.cs.getPendingPlaces(); }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: process.env.JWT_SECRET || 'super_secret_voyagora_key_123' })))
  @Patch(':id/approve') async approve(@Request() req: any, @Param('id') id: string) { if (req.user.role !== 'ADMIN') throw new ForbiddenException('Admin only'); return this.cs.approvePlace(id); }
}
