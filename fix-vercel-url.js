const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// OVERWRITE CONFIG.TS WITH BULLETPROOF PRODUCTION LOGIC
createFile('apps/web/src/config.ts', `
// Vite automatically sets import.meta.env.PROD to true when building for Vercel.
// This completely bypasses the need for Vercel Environment Variables.
const isProd = import.meta.env.PROD;

// In production (Vercel), use the live Render URL. Locally, use localhost.
export const API_URL = isProd 
  ? 'https://voyagora.onrender.com' 
  : 'http://localhost:3000';
`);

console.log('\n✨ Bulletproof URL Fix Applied!');
