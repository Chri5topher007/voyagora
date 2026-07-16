const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// OVERWRITE CONFIG.TS WITH A CLEAN, SELF-CONTAINED FILE
createFile('apps/web/src/config.ts', `
// Centralized API URL. 
// Uses Vercel env var in production, falls back to localhost for dev.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
`);

console.log('\n✨ config.ts cleaned successfully!');
