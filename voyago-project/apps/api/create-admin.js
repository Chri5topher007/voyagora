// One-off script to create (or promote an existing account to) an admin.
// Credentials are passed in as environment variables at run time — never
// hardcoded here — so nothing sensitive ever gets committed to git history.
//
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='YourStrongPassword' node create-admin.js
//
// Safe to run more than once: if the email already exists, it just updates
// that account's password and promotes it to ADMIN instead of erroring.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="YourStrongPassword" node create-admin.js');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, role: 'ADMIN' },
    create: { email, password: hashedPassword, name, role: 'ADMIN' },
  });

  console.log(`✅ Admin account ready: ${user.email} (role: ${user.role})`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Failed to create admin:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
