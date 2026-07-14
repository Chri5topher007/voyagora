const fs = require('fs');
const path = require('path');

function createFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Created ' + filePath);
}

// 1. ROOT FILES (Docker & Env)
createFile('docker-compose.yml', `
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: voyagora
      POSTGRES_PASSWORD: voyagora123
      POSTGRES_DB: voyagora
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  api:
    build: ./apps/api
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgresql://voyagora:voyagora123@postgres:5432/voyagora?schema=public
      - JWT_SECRET=super_secret_voyagora_key_123
      - FRONTEND_URL=http://localhost:8080
    depends_on: [postgres]
    command: sh -c "npx prisma db push && node dist/main.js"

  web:
    build: ./apps/web
    ports: ["8080:80"]
    depends_on: [api]

volumes:
  pgdata:
`);

createFile('.env', `DATABASE_URL="postgresql://voyagora:voyagora123@localhost:5432/voyagora?schema=public"`);

// 2. BACKEND (NestJS API)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { start: "node dist/main", build: "tsc -p tsconfig.json" },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@prisma/client": "^5.0.0", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/node": "^20.0.0", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

createFile('apps/api/Dockerfile', `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
`);

createFile('apps/api/tsconfig.json', JSON.stringify({
  compilerOptions: {
    module: "commonjs", target: "es2021", outDir: "./dist", rootDir: "./src",
    strict: true, experimentalDecorators: true, emitDecoratorMetadata: true, skipLibCheck: true
  }
}, null, 2));

createFile('apps/api/prisma/schema.prisma', `
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }
model Destination {
  id          String   @id @default(uuid())
  name        String
  description String
  createdAt   DateTime @default(now())
}
`);

createFile('apps/api/src/prisma.service.ts', `
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() { await this.\$connect(); }
}
`);

createFile('apps/api/src/app.controller.ts', `
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('destinations')
  async getDestinations() {
    return this.prisma.destination.findMany();
  }
}
`);

createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
`);

createFile('apps/api/src/main.ts', `
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  
  const prismaService = app.get(PrismaService);
  
  // Auto-seed database if empty
  const count = await prismaService.destination.count();
  if (count === 0) {
    await prismaService.destination.createMany({
      data: [
        { name: 'Maldives', description: 'Crystal clear waters and overwater bungalows.' },
        { name: 'Kerala', description: 'Gods Own Country with lush backwaters and tea gardens.' }
      ]
    });
  }

  await app.listen(3000);
  console.log('🚀 Voyagora API running on http://localhost:3000');
}
bootstrap();
`);

// 3. FRONTEND (React + Vite + Tailwind)
createFile('apps/web/package.json', JSON.stringify({
  name: "web", private: true, version: "0.0.0", type: "module",
  scripts: { build: "tsc && vite build" },
  dependencies: { "framer-motion": "^11.0.0", "react": "^18.2.0", "react-dom": "^18.2.0" },
  devDependencies: {
    "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0", "postcss": "^8.4.0", "tailwindcss": "^3.4.0", "typescript": "^5.2.0", "vite": "^5.0.0"
  }
}, null, 2));

createFile('apps/web/Dockerfile', `
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`);

createFile('apps/web/tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "ESNext", useDefineForClassFields: true, lib: ["DOM", "DOM.Iterable", "ESNext"],
    module: "ESNext", skipLibCheck: true, moduleResolution: "bundler",
    allowImportingTsExtensions: true, resolveJsonModule: true, isolatedModules: true,
    noEmit: true, jsx: "react-jsx", strict: true
  }, include: ["src"]
}, null, 2));

createFile('apps/web/vite.config.ts', `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`);

createFile('apps/web/tailwind.config.js', `
export default { content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], theme: { extend: {} }, plugins: [] }
`);

createFile('apps/web/postcss.config.js', `
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
`);

createFile('apps/web/index.html', `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voyagora</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

createFile('apps/web/src/index.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;
`);

createFile('apps/web/src/main.tsx', `
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
`);

createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function App() {
  const [destinations, setDestinations] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/destinations')
      .then(res => res.json())
      .then(data => setDestinations(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-indigo-600 mb-2">Voyagora</h1>
        <p className="text-gray-500 text-xl">Your Travel Operating System</p>
      </header>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
        {destinations.map((dest: any, i) => (
          <motion.div 
            key={dest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{dest.name}</h2>
            <p className="text-gray-600">{dest.description}</p>
            <button className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700">
              Explore Packages
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
`);

console.log('\n✨ Voyagora project successfully created!');
console.log('Next steps:');
console.log('1. Open your terminal in this folder');
console.log('2. Run: docker-compose up --build');
