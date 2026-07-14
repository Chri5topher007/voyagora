
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CommunityService } from './community.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    try { req.user = this.jwtService.verify(token); return true; } catch (e) { return false; }
  }
}

@Controller('community')
export class CommunityController {
  constructor(private readonly cs: CommunityService, private jwtService: JwtService) {}

  @Get()
  async getApproved() {
    return this.cs.getApprovedPlaces();
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post()
  async submit(@Request() req: any, @Body() body: { name: string; description: string; imageUrl: string }) {
    return this.cs.submitPlace(req.user.sub, body);
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Get('pending')
  async getPending(@Request() req: any) {
    if (req.user.role !== 'ADMIN') throw new Error('Admin only');
    return this.cs.getPendingPlaces();
  }

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Patch(':id/approve')
  async approve(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== 'ADMIN') throw new Error('Admin only');
    return this.cs.approvePlace(id);
  }
}
