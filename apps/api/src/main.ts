
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  
  const prismaService = app.get(PrismaService);
  
  // Seed default coupon
  const couponExists = await prismaService.coupon.findUnique({ where: { code: 'VOYAGORA100' } });
  if (!couponExists) {
    await prismaService.coupon.create({ data: { code: 'VOYAGORA100', discountAmount: 100 } });
    console.log('🎟️ Default coupon VOYAGORA100 created!');
  }

  await app.listen(3000);
  console.log('🚀 Voyagora API running on http://localhost:3000');
}
bootstrap();
