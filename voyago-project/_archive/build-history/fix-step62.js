const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// GUARANTEE clear-data.js EXISTS ON DISK
createFile('apps/api/clear-data.js', `
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
`);

console.log('\n✨ Step 62 (Restored clear-data.js) successfully patched!');
