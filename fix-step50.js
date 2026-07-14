const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. ADD TYPESCRIPT DECLARATIONS FOR MISSING TYPES
createFile('apps/api/src/types.d.ts', `
declare module 'multer-storage-cloudinary';
`);

console.log('\n✨ Step 50 (TypeScript Module Declarations) successfully patched!');
