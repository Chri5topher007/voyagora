const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE COMMUNITY SERVICE (Accept lat/lng)
createFile('apps/api/src/community.service.ts', `
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async submitPlace(userId: string, dto: any) {
    return this.prisma.communityPlace.create({
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        lat: dto.lat || 0,
        lng: dto.lng || 0,
        uploadedBy: userId,
      },
    });
  }

  async getApprovedPlaces() {
    return this.prisma.communityPlace.findMany({ where: { status: 'APPROVED' } });
  }

  async getPendingPlaces() {
    return this.prisma.communityPlace.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { name: true } } },
    });
  }

  async approvePlace(id: string) {
    return this.prisma.communityPlace.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }
}
`);

// 2. UPGRADE HIDDEN GEMS PAGE (Add Image Upload & Map)
createFile('apps/web/src/pages/HiddenGems.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MapPicker from '../components/MapPicker';
import ImageUpload from '../components/ImageUpload';

export default function HiddenGems() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', imageUrl: '', lat: 0, lng: 0 });

  const fetchPlaces = () => fetch('http://localhost:3000/community').then(res => res.json()).then(data => setPlaces(data));

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login');
    fetchPlaces();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(formData)
    });
    setShowForm(false);
    setFormData({ name: '', description: '', imageUrl: '', lat: 0, lng: 0 });
    alert('Submitted! It will appear once an Admin approves it.');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900">Hidden Gems 💎</h1>
            <p className="text-slate-500 mt-1">Discover unbelievable spots shared by travelers.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500">+ Share a Gem</button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {places.map(p => (
            <div key={p.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
              <img src={p.imageUrl} alt={p.name} className="w-full h-48 object-cover" />
              <div className="p-5">
                <h3 className="text-xl font-bold text-slate-900">{p.name}</h3>
                <p className="text-slate-500 text-sm mt-1">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Share a Hidden Gem</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" required placeholder="Name (e.g., Secret Waterfall)" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
                <textarea required placeholder="Description" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 bg-slate-100 rounded-xl outline-none h-24 text-slate-800" />
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Photo</label>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />}
                  <ImageUpload onUpload={(url) => setFormData({ ...formData, imageUrl: url })} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pin Location on Map</label>
                  <MapPicker lat={formData.lat} lng={formData.lng} setPos={(lat, lng) => setFormData({ ...formData, lat, lng })} />
                </div>

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500">Submit for Review</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
`);

console.log('\n✨ Step 31 (Premium Hidden Gems Upload) successfully generated!');
