const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE SEED.JS (Only create 3 users, no dummy tours/events/gems)
createFile('apps/api/seed.js', `
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
  await prisma.user.upsert({
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
  await prisma.user.upsert({
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

  console.log('✅ 3 Dummy Users seeded successfully (No Tours/Events/Gems)!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
`);

// 2. UPDATE APP.TSX FOOTER (Remove Company links, add Contact)
let appContent = fs.readFileSync('apps/web/src/App.tsx', 'utf8');

const oldFooterCompanySection = `<div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              <li onClick={() => alert('About Us page coming soon!')} className="hover:text-white cursor-pointer">About Us</li>
              <li onClick={() => alert('Careers page coming soon!')} className="hover:text-white cursor-pointer">Careers</li>
              <li onClick={() => alert('Contact page coming soon!')} className="hover:text-white cursor-pointer">Contact</li>
            </ul>
          </div>`;

const newFooterCompanySection = `<div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <p className="text-sm text-slate-400">Contact: 8078260288</p>
          </div>`;

appContent = appContent.replace(oldFooterCompanySection, newFooterCompanySection);

fs.writeFileSync('apps/web/src/App.tsx', appContent);
console.log('✅ App.tsx Footer updated with Contact info!');

console.log('\n✨ UI and Seed Data Updated Successfully!');
