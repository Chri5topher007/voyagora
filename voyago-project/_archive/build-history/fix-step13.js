const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. UPGRADE MAP PICKER (Add Location Search)
createFile('apps/web/src/components/MapPicker.tsx', `
import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ChangeMapView({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  if (lat !== 0 && lng !== 0) {
    map.flyTo([lat, lng], 13, { duration: 1.5 });
  }
  return null;
}

function LocationMarker({ setPos }: { setPos: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { setPos(e.latlng.lat, e.latlng.lng); }
  });
  return null;
}

export default function MapPicker({ lat, lng, setPos }: { lat: number, lng: number, setPos: (lat: number, lng: number) => void }) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(searchQuery);
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.length > 0) {
        setPos(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        alert('Location not found. Try another search.');
      }
    } catch (err) {
      alert('Failed to search location.');
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input 
          type="text" 
          placeholder="Search location (e.g., Kerala, India)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2.5 bg-slate-100 rounded-lg outline-none text-sm text-slate-800"
        />
        <button type="submit" className="bg-indigo-600 text-white px-4 rounded-lg text-sm font-semibold hover:bg-indigo-700">Search</button>
      </form>
      
      <MapContainer center={[lat || 20, lng || 78]} zoom={5} style={{ height: '300px', width: '100%' }} className="rounded-xl z-0">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ChangeMapView lat={lat} lng={lng} />
        {lat !== 0 && <Marker position={[lat, lng]} />}
        <LocationMarker setPos={setPos} />
      </MapContainer>
      <p className="text-xs text-slate-500 mt-2">Search for a place, or click directly on the map to drop the exact pin.</p>
    </div>
  );
}
`);

// 2. UPGRADE DASHBOARD (Rupee Symbol & Explicit Back Button)
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
    await fetch('http://localhost:3000/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
                <button onClick={() => setType('TOUR')} className={"flex-1 py-2 rounded-lg font-semibold " + (type === 'TOUR' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Tour</button>
                <button onClick={() => setType('EVENT')} className={"flex-1 py-2 rounded-lg font-semibold " + (type === 'EVENT' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Event</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <input type="text" required placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
                <textarea required placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none h-24 text-slate-800" />
                
                {/* Amount Input with ₹ Prefix */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input 
                    type="number" required placeholder="0.00" value={formData.price || ''} 
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} 
                    className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" 
                  />
                </div>

                {type === 'EVENT' && <input type="datetime-local" required value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Upload Image</label>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />}
                  <ImageUpload onUpload={(url) => setFormData({ ...formData, imageUrl: url })} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Location on Map</label>
                  <MapPicker lat={formData.lat} lng={formData.lng} setPos={(lat, lng) => setFormData({ ...formData, lat, lng })} />
                </div>

                <div className="flex gap-4 pt-2">
                  {/* Explicit Back to Dashboard Button */}
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300">
                    ← Back to Dashboard
                  </button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500">
                    Save Listing
                  </button>
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

console.log('\n✨ Step 13 (Map Search, UI Polish) successfully generated!');
