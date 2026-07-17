
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Fail fast in production if critical secrets are missing, rather than
// silently falling back to insecure defaults baked into the code.
function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_SECRET', 'DATABASE_URL', 'STRIPE_SECRET_KEY', 'FRONTEND_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required production environment variables: ${missing.join(', ')}`);
    console.error('Set these in your hosting provider before starting the API in production.');
    process.exit(1);
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET is not set — payments will only be confirmed via browser redirect, not the reliable server-to-server webhook. See DEPLOYMENT.md.');
  }
}

async function bootstrap() {
  assertProductionEnv();
  // rawBody: true keeps the original request body bytes available at
  // req.rawBody (needed to verify the Stripe webhook signature) while still
  // parsing JSON normally for every other route.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Basic security headers (HSTS, no-sniff, frameguard, etc.)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Allow one or more comma-separated origins via FRONTEND_URL (e.g.
  // "https://voyagora.com,https://www.voyagora.com"). Falls back to '*' only
  // when nothing is configured, which is fine for local dev but should always
  // be set explicitly in production.
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: configuredOrigins.length > 0 ? configuredOrigins : '*',
    credentials: true,
  });

  // Reject unknown fields, strip anything not declared on a DTO, and
  // auto-convert query/param strings to the right types. This is what
  // actually enforces every @Is... decorator across all the DTOs.
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalFilters(new AllExceptionsFilter());

  const prismaService = app.get(PrismaService);

  // Seed default coupon
  const couponExists = await prismaService.coupon.findUnique({ where: { code: 'VOYAGORA100' } });
  if (!couponExists) {
    await prismaService.coupon.create({ data: { code: 'VOYAGORA100', discountAmount: 100 } });
    console.log('🎟️ Default coupon VOYAGORA100 created!');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Voyagora API running on port ${port}`);
}
bootstrap();
