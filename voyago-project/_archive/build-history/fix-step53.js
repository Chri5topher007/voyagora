const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FIX PACKAGE.JSON (Downgrade cloudinary to v1 to match multer-storage-cloudinary)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { 
    start: "node dist/main", 
    build: "tsc -p tsconfig.json",
    "db:migrate": "prisma db push --accept-data-loss && node dist/main.js"
  },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "cloudinary": "^1.41.0", "multer": "^1.4.5-lts.1", "multer-storage-cloudinary": "^4.0.0",
    "nodemailer": "^6.9.13", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "@types/nodemailer": "^6.4.15", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. UPDATE DOCKERFILE (Use --legacy-peer-deps to avoid any future conflicts)
createFile('apps/api/Dockerfile', `
FROM node:18-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
RUN mkdir -p /app/uploads
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
`);

console.log('\n✨ Step 53 (Dependency Conflict Fix) successfully patched!');
