const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// UPDATE SEED.JS TO DYNAMICALLY HASH THE REAL PASSWORD
createFile('apps/api/seed.js', `
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Dynamically hash the real password so it works perfectly with the backend
  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Admin User
  await prisma.user.upsert({
    where: { email: 'admin@voyagora.com' },
    update: { password: passwordHash, role: 'ADMIN' },
    create: {
      email: 'admin@voyagora.com',
      password: passwordHash,
      name: 'Voyagora Admin',
      role: 'ADMIN',
      bio: 'Platform Administrator.',
      profileImageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'
    },
  });

  // 2. Create Organizer User
  await prisma.user.upsert({
    where: { email: 'organizer@voyagora.com' },
    update: { password: passwordHash, subscriptionStatus: 'ACTIVE', role: 'ORGANIZER' },
    create: {
      email: 'organizer@voyagora.com',
      password: passwordHash,
      name: 'Voyagora Official',
      role: 'ORGANIZER',
      subscriptionStatus: 'ACTIVE',
      bio: 'Premium travel experiences curated by the Voyagora team.',
      profileImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80'
    },
  });

  // 3. Create Traveler User
  await prisma.user.upsert({
    where: { email: 'traveler@voyagora.com' },
    update: { password: passwordHash, role: 'TRAVELER' },
    create: {
      email: 'traveler@voyagora.com',
      password: passwordHash,
      name: 'Alex Wanderlust',
      role: 'TRAVELER',
      bio: 'Exploring the unseen.',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
    },
  });

  console.log('✅ 3 Dummy Users seeded successfully with REAL password hash!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
`);

console.log('\n✨ Seed Script Hash Fix Applied!');
