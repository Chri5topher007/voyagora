const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE API PACKAGE.JSON (Multer for uploads, OpenAI, Static serving)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { start: "node dist/main", build: "tsc -p tsconfig.json" },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/serve-static": "^4.0.0", "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "multer": "^1.4.5-lts.1", "openai": "^4.28.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. UPDATE DOCKERFILE (Create uploads directory)
createFile('apps/api/Dockerfile', `
FROM node:18-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
RUN mkdir -p /app/uploads
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
`);

// 3. UPDATE PRISMA SCHEMA (Add Events, Lat/Lng, Image paths)
createFile('apps/api/prisma/schema.prisma', `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
generator client {
  provider = "prisma-client-js"
}
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("TRAVELER")
  tours     Tour[]
  events    Event[]
  bookings  Booking[]
  places    CommunityPlace[]
  createdAt DateTime @default(now())
}
model Tour {
  id          String   @id @default(uuid())
  title       String
  description String
  price       Float
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  organizerId String
  organizer   User     @relation(fields: [organizerId], references: [id])
  bookings    Booking[]
  createdAt   DateTime @default(now())
}
model Event {
  id          String   @id @default(uuid())
  title       String
  description String
  price       Float
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  eventDate   DateTime
  organizerId String
  organizer   User     @relation(fields: [organizerId], references: [id])
  createdAt   DateTime @default(now())
}
model Booking {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  tourId          String?
  tour            Tour?    @relation(fields: [tourId], references: [id])
  eventId         String?
  event           Event?   @relation(fields: [eventId], references: [id])
  totalAmount     Float
  platformFee     Float
  organizerPayout Float
  status          String   @default("CONFIRMED")
  qrCode          String   @unique
  isCheckedIn     Boolean  @default(false)
  createdAt       DateTime @default(now())
}
model CommunityPlace {
  id          String   @id @default(uuid())
  name        String
  description String
  imageUrl    String
  lat         Float    @default(0)
  lng         Float    @default(0)
  status      String   @default("PENDING")
  uploadedBy  String
  user        User     @relation(fields: [uploadedBy], references: [id])
  createdAt   DateTime @default(now())
}
`);

// 4. CREATE UPLOAD CONTROLLER (Handles real image uploads)
createFile('apps/api/src/upload.controller.ts', `
import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('uploads')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, \`\${randomName}\${extname(file.originalname)}\`);
      }
    })
  }))
  uploadFile(@UploadedFile() file: any) {
    return { url: \`http://localhost:3000/uploads/\${file.filename}\` };
  }
}
`);

// 5. UPDATE AI SERVICE (Real OpenAI API)
createFile('apps/api/src/ai.service.ts', `
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateItinerary(prompt: string) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a travel expert. Create a 3-day itinerary based on the user prompt. Respond ONLY in JSON format: {"destination": "Name", "estimatedBudget": "₹X", "days": [{"day": 1, "morning": "", "afternoon": "", "evening": "", "stay": "", "food": ""}]}' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      console.error('OpenAI Error, falling back to mock');
      return { destination: 'Error generating AI', estimatedBudget: 'N/A', days: [] };
    }
  }
}
`);

// 6. CREATE EVENT SERVICE & CONTROLLER
createFile('apps/api/src/event.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}
  async createEvent(organizerId: string, dto: any) {
    return this.prisma.event.create({ data: { ...dto, organizerId, eventDate: new Date(dto.eventDate) } });
  }
  async getAllEvents() {
    return this.prisma.event.findMany({ include: { organizer: { select: { name: true } } }, orderBy: { eventDate: 'asc' } });
  }
}
`);

createFile('apps/api/src/event.controller.ts', `
import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { EventService } from './event.service';
import { JwtService } from '@nestjs/jwt';
class JwtAuthGuard { constructor(private jwtService: JwtService) {} canActivate(context: any) { const req = context.switchToHttp().getRequest(); const authHeader = req.headers.authorization; if (!authHeader) return false; try { req.user = this.jwtService.verify(authHeader.split(' ')[1]); return true; } catch (e) { return false; } } }
@Controller('events')
export class EventController {
  constructor(private readonly es: EventService, private jwtService: JwtService) {}
  @Get() async getAll() { return this.es.getAllEvents(); }
  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post() async create(@Request() req: any, @Body() body: any) { return this.es.createEvent(req.user.sub, body); }
}
`);

// 7. UPDATE TOUR SERVICE (Add Lat/Lng)
createFile('apps/api/src/tour.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
@Injectable()
export class TourService {
  constructor(private prisma: PrismaService) {}
  async createTour(organizerId: string, dto: any) { return this.prisma.tour.create({ data: { ...dto, organizerId } }); }
  async getAllTours() { return this.prisma.tour.findMany({ include: { organizer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }); }
}
`);

// 8. UPDATE COMMUNITY SERVICE (Add Lat/Lng)
createFile('apps/api/src/community.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}
  async submitPlace(userId: string, dto: any) { return this.prisma.communityPlace.create({ data: { ...dto, uploadedBy: userId } }); }
  async getApprovedPlaces() { return this.prisma.communityPlace.findMany({ where: { status: 'APPROVED' } }); }
  async getPendingPlaces() { return this.prisma.communityPlace.findMany({ where: { status: 'PENDING' }, include: { user: { select: { name: true } } } }); }
  async approvePlace(id: string) { return this.prisma.communityPlace.update({ where: { id }, data: { status: 'APPROVED' } }); }
}
`);

// 9. UPDATE APP MODULE (Wire everything up + Static serving for uploads)
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { UploadController } from './upload.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'uploads'), serveRoot: '/uploads' }),
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController, CommunityController, EventController, UploadController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService, CommunityService, EventService],
})
export class AppModule {}
`);

// 10. UPDATE WEB PACKAGE.JSON (Add Leaflet Maps)
createFile('apps/web/package.json', JSON.stringify({
  name: "web", private: true, version: "0.0.0", type: "module",
  scripts: { build: "tsc && vite build" },
  dependencies: {
    "framer-motion": "^11.0.0", "html5-qrcode": "^2.3.8", "leaflet": "^1.9.4", 
    "react": "^18.2.0", "react-dom": "^18.2.0", "react-leaflet": "^4.2.1", "react-router-dom": "^6.22.0"
  },
  devDependencies: {
    "@types/leaflet": "^1.9.8", "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0", "postcss": "^8.4.0", "tailwindcss": "^3.4.0", "typescript": "^5.2.0", "vite": "^5.0.0"
  }
}, null, 2));

// 11. CREATE MAP COMPONENT
createFile('apps/web/src/components/MapPicker.tsx', `
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon issue in Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationMarker({ setPos }: { setPos: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) { setPos(e.latlng.lat, e.latlng.lng); map.flyTo(e.latlng, map.getZoom()); }
  });
  return null;
}

export default function MapPicker({ lat, lng, setPos }: { lat: number, lng: number, setPos: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={5} style={{ height: '300px', width: '100%' }} className="rounded-xl z-0">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {lat !== 0 && <Marker position={[lat, lng]} />}
      <LocationMarker setPos={setPos} />
    </MapContainer>
  );
}
`);

// 12. CREATE IMAGE UPLOAD COMPONENT
createFile('apps/web/src/components/ImageUpload.tsx', `
import { useState } from 'react';
export default function ImageUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const [loading, setLoading] = useState(false);
  const handleFile = async (e: any) => {
    setLoading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('http://localhost:3000/uploads', { method: 'POST', body: formData });
    const data = await res.json();
    onUpload(data.url);
    setLoading(false);
  };
  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFile} className="w-full p-3 bg-slate-700 text-white rounded-xl outline-none" />
      {loading && <p className="text-slate-400 text-sm mt-1">Uploading...</p>}
    </div>
  );
}
`);

// 13. UPDATE DASHBOARD (Add Events, Maps, Uploads)
createFile('apps/web/src/pages/Dashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MapPicker from '../components/MapPicker';
import ImageUpload from '../components/ImageUpload';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tours, setTours] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('TOUR');
  const [formData, setFormData] = useState({ title: '', description: '', price: 0, imageUrl: '', lat: 0, lng: 0, eventDate: '' });

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const tRes = await fetch('http://localhost:3000/tours'); setTours(await tRes.json());
    const eRes = await fetch('http://localhost:3000/events'); setEvents(await eRes.json());
  };
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const endpoint = type === 'TOUR' ? 'tours' : 'events';
    await fetch(\`http://localhost:3000/\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
      body: JSON.stringify(formData)
    });
    setShowForm(false);
    setFormData({ title: '', description: '', price: 0, imageUrl: '', lat: 0, lng: 0, eventDate: '' });
    fetchData();
  };

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800">Organizer Dashboard</h1>
          <div className="flex gap-4">
            <button onClick={() => navigate('/scanner')} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-500">Scan Tickets</button>
            <button onClick={logout} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-100">Logout</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 flex justify-between items-center">
          <div><h2 className="text-xl font-bold text-slate-800">Inventory</h2><p className="text-slate-500">Create Tours and Events.</p></div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500">+ Create New</button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {tours.map(t => (
            <div key={t.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <img src={t.imageUrl} alt={t.title} className="w-full h-40 object-cover" />
              <div className="p-4"><h3 className="font-bold text-lg text-slate-800">{t.title}</h3><p className="text-indigo-600 font-bold">₹{t.price}</p></div>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-slate-800 mb-4">Upcoming Events</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {events.map(e => (
            <div key={e.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <img src={e.imageUrl} alt={e.title} className="w-full h-40 object-cover" />
              <div className="p-4"><h3 className="font-bold text-lg text-slate-800">{e.title}</h3><p className="text-slate-500 text-sm">{new Date(e.eventDate).toLocaleDateString()}</p></div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New Listing</h2>
              <div className="flex gap-4 mb-6 bg-slate-100 p-2 rounded-xl">
                <button onClick={() => setType('TOUR')} className={\`flex-1 py-2 rounded-lg font-semibold \${type === 'TOUR' ? 'bg-indigo-600 text-white' : 'text-slate-600'}\`}>Tour</button>
                <button onClick={() => setType('EVENT')} className={\`flex-1 py-2 rounded-lg font-semibold \${type === 'EVENT' ? 'bg-indigo-600 text-white' : 'text-slate-600'}\`}>Event</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <input type="text" required placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none" />
                <textarea required placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none h-24" />
                <input type="number" required placeholder="Price (₹)" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-3 bg-slate-100 rounded-xl outline-none" />
                {type === 'EVENT' && <input type="datetime-local" required value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none" />}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Image</label>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />}
                  <ImageUpload onUpload={(url) => setFormData({ ...formData, imageUrl: url })} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Location on Map</label>
                  <MapPicker lat={formData.lat} lng={formData.lng} setPos={(lat, lng) => setFormData({ ...formData, lat, lng })} />
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500">Save Listing</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
`);

console.log('\n✨ Step 9 (Real AI, Uploads, Maps, Events) backend & dashboard generated!');
