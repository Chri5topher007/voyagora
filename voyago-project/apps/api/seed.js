
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Create Admin User
  await prisma.user.upsert({
    where: { email: 'admin@voyagora.com' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin@voyagora.com',
      password: '$2a$10$K7L1OJ45/4Y2nIvhVp9c4uX1ZxZ8o7w9q3zYxW0v1u2t3s4r5p6o7i',
      name: 'Voyagora Admin',
      role: 'ADMIN',
      bio: 'Platform Administrator.',
      profileImageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'
    },
  });

  // 2. Create Organizer User
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@voyagora.com' },
    update: {},
    create: {
      email: 'organizer@voyagora.com',
      password: '$2a$10$K7L1OJ45/4Y2nIvhVp9c4uX1ZxZ8o7w9q3zYxW0v1u2t3s4r5p6o7i',
      name: 'Voyagora Official',
      role: 'ORGANIZER',
      subscriptionStatus: 'ACTIVE',
      bio: 'Premium travel experiences curated by the Voyagora team.',
      profileImageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80'
    },
  });

  // 3. Create Traveler User
  const traveler = await prisma.user.upsert({
    where: { email: 'traveler@voyagora.com' },
    update: {},
    create: {
      email: 'traveler@voyagora.com',
      password: '$2a$10$K7L1OJ45/4Y2nIvhVp9c4uX1ZxZ8o7w9q3zYxW0v1u2t3s4r5p6o7i',
      name: 'Alex Wanderlust',
      role: 'TRAVELER',
      bio: 'Exploring the unseen.',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
    },
  });

  // 4. Create 1 Tour (Owned by Organizer)
  await prisma.tour.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Magical Maldives Getaway',
        description: 'Spend 5 days in an overwater bungalow. Includes scuba diving, snorkeling, and private beach dinners. Flights not included.',
        price: 45000,
        imageUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80',
        gallery: ["https://images.unsplash.com/photo-1573843981267-be1999ff37cd?auto=format&fit=crop&w=800&q=80"],
        lat: 3.2028, lng: 73.2207,
        organizerId: organizer.id,
        paymentType: 'ADVANCE', advanceAmount: 10000, gstPercentage: 5
      }
    ]
  });

  // 5. Create 1 Event (Owned by Organizer)
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 14);

  await prisma.event.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Goa Sunburn Beach Festival',
        description: 'The biggest electronic music festival in India. 3 days of non-stop music, beach parties, and international DJs.',
        price: 5000,
        imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=800&q=80',
        gallery: [],
        lat: 15.2993, lng: 74.1240,
        eventDate: futureDate1,
        organizerId: organizer.id,
        paymentType: 'FULL', gstPercentage: 18
      }
    ]
  });

  // 6. Create 1 Approved Hidden Gem (Uploaded by Traveler)
  await prisma.communityPlace.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Secret Waterfall, Wayanad',
        description: 'A hidden gem deep inside the forest. Requires a 2km trek, but the view is absolutely worth it. Best visited just after monsoon.',
        imageUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
        lat: 11.6854, lng: 76.1320,
        status: 'APPROVED',
        uploadedBy: traveler.id
      }
    ]
  });

  console.log('✅ Dummy data seeded successfully (Admin, Organizer, Traveler)!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
