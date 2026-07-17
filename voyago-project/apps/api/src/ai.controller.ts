
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GenerateItineraryDto } from './common/dto/misc.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // OpenAI calls cost real money per request — throttle harder than the
  // global default so one user can't run up the bill via a script loop.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Post('itinerary')
  async generate(@Body() body: GenerateItineraryDto) {
    return this.aiService.generateItinerary(body.prompt);
  }
}
