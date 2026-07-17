
import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { Roles } from './common/decorators/roles.decorator';
import { SubmitPlaceDto } from './common/dto/misc.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly cs: CommunityService) {}

  // NOTE: 'pending' must come before ':id' for the same reason as
  // tours/stats above — this was a real bug (GET /community/pending
  // previously 404'd via getPlaceById('pending') instead of reaching here).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('pending')
  async getPending() {
    return this.cs.getPendingPlaces();
  }

  @Get()
  async getApproved() {
    return this.cs.getApprovedPlaces();
  }

  @Get(':id')
  async getPlaceById(@Param('id') id: string) {
    return this.cs.getPlaceById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async submit(@Request() req: any, @Body() body: SubmitPlaceDto) {
    return this.cs.submitPlace(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    return this.cs.approvePlace(id);
  }
}
