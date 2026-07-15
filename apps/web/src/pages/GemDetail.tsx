
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function GemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gem, setGem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/community/' + id)
      .then(res => res.json())
      .then(data => { setGem(data); setLoading(false); })
      .catch(() => { alert('Gem not found'); navigate('/'); });
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading gem...</div>;
  if (!gem) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={gem.imageUrl} alt={gem.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        
        <button onClick={() => navigate('/explore/gems')} className="absolute top-6 left-6 bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition flex items-center gap-2">
          ← Back to Gems
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-yellow-500 px-3 py-1 rounded-full text-xs font-bold">Hidden Gem</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{gem.name}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About this place</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{gem.description}</p>
          </div>

          {gem.lat !== 0 && gem.lng !== 0 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Map Location</h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200 z-0">
                <MapContainer center={[gem.lat, gem.lng]} zoom={13} style={{ height: '300px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[gem.lat, gem.lng]} />
                </MapContainer>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 sticky top-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Discovered By</h3>
            <div className="flex items-center gap-3">
              <img src={gem.user.profileImageUrl || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full object-cover" />
              <p className="font-bold text-slate-900">{gem.user.name}</p>
            </div>
            <button onClick={() => navigate('/explore/gems')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 mt-6">Explore More Gems</button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
