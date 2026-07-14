const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// ADD TYPESCRIPT DECLARATIONS FOR BOTH MISSING TYPES
createFile('apps/api/src/types.d.ts', `
declare module 'multer-storage-cloudinary';
declare module 'cloudinary';
`);

console.log('\n✨ Step 51 (Cloudinary Types Fix) successfully patched!');
