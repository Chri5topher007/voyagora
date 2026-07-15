
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('⚠️ Wiping all data from database...');
  
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.communityPlace.deleteMany();
  await prisma.event.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ All data wiped successfully! The database is now empty.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
