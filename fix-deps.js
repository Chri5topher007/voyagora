const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// GUARANTEE ALL BACKEND DEPENDENCIES ARE PRESENT
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { 
    start: "node dist/main", 
    build: "tsc -p tsconfig.json",
    "db:migrate": "prisma db push --accept-data-loss && node seed.js && node dist/main.js"
  },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/throttler": "^5.1.1", "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "class-validator": "^0.14.1", "class-transformer": "^0.5.1",
    "cloudinary": "^1.41.0", "helmet": "^7.1.0", "multer": "^1.4.5-lts.1", "multer-storage-cloudinary": "^4.0.0",
    "nodemailer": "^6.9.13", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "@types/nodemailer": "^6.4.15", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

console.log('\n✨ Dependencies Fixed!');
