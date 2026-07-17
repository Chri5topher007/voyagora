
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MapModal({ lat, lng, title, onClose }: { lat: number, lng: number, title: string, onClose: () => void }) {
  if (lat === 0 && lng === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white p-6 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-slate-700 mb-4">No location coordinates provided for this listing.</p>
          <button onClick={onClose} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-semibold">Close</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-slate-800">📍 {title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 text-2xl">×</button>
        </div>
        <div className="rounded-xl overflow-hidden border border-slate-200 z-0">
          <MapContainer center={[lat, lng]} zoom={13} style={{ height: '400px', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[lat, lng]} />
          </MapContainer>
        </div>
      </motion.div>
    </motion.div>
  );
}
