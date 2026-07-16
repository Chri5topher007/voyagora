
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
