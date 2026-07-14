
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  }

  async generateItinerary(prompt: string) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a travel expert. Create a 3-day itinerary based on the user prompt. Respond ONLY in JSON format: {"destination": "Name", "estimatedBudget": "₹X", "days": [{"day": 1, "morning": "", "afternoon": "", "evening": "", "stay": "", "food": ""}]}' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (e) {
      console.error('OpenAI Error, falling back to mock');
      return { destination: 'Error generating AI', estimatedBudget: 'N/A', days: [] };
    }
  }
}
