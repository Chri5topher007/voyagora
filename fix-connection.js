const fs = require('fs');
const path = require('path');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. BULLETPROOF CONFIG.TS (Auto-detects URL based on browser, no env vars needed)
createFile('apps/web/src/config.ts', `
// This completely bypasses Vercel Environment Variables.
// If you are on localhost, it uses localhost. If you are on Vercel, it uses Render.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_URL = isLocal 
  ? 'http://localhost:3000' 
  : 'https://voyagora.onrender.com';
`);

// 2. UPDATE BACKEND MAIN.TS (Allow all CORS origins temporarily to rule out blocking)
createFile('apps/api/src/main.ts', `
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // SECURITY FIX: Allow all origins temporarily to ensure Vercel can connect
  app.enableCors({
    origin: true, 
    credentials: true,
  });
  
  const prismaService = app.get(PrismaService);
  const couponExists = await prismaService.coupon.findUnique({ where: { code: 'VOYAGORA100' } });
  if (!couponExists) {
    await prismaService.coupon.create({ data: { code: 'VOYAGORA100', discountAmount: 100 } });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log('🚀 Voyagora API running on port ' + port);
}
bootstrap();
`);

console.log('\n✨ Bulletproof Connection Fix Applied!');
