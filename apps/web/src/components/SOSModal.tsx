
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function SOSModal({ onClose }: { onClose: () => void }) {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          // Fetch nearby hospitals from OpenStreetMap Overpass API
          try {
            const radius = 5000; // 5km
            const query = `[out:json];node(amenity=hospital|amenity=clinic)(around:${radius},${lat},${lng});out;`;
            const res = await fetch('https://overpass-api.de/api/interpreter', {
              method: 'POST',
              body: query
            });
            const data = await res.json();
            setHospitals(data.elements.slice(0, 5)); // Get top 5 nearest
          } catch (e) {
            console.error('Failed to fetch hospitals');
          }
        },
        (err) => setError('Location access denied. Please enable location services.'),
        { enableHighAccuracy: true }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-red-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">🆘 Emergency SOS</h2>
            <p className="text-red-200 text-sm">Stay calm. Help is on the way.</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-3xl">×</button>
        </div>

        <div className="p-6">
          {error ? (
            <div className="text-center text-red-600 bg-red-50 p-4 rounded-xl">{error}</div>
          ) : !location ? (
            <div className="text-center text-slate-500 py-8">📍 Detecting your location...</div>
          ) : (
            <>
              {/* Emergency Call Button */}
              <a href="tel:112" className="block w-full bg-red-600 text-white text-center py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition mb-6 shadow-lg shadow-red-600/30">
                📞 Call Emergency Services (112)
              </a>

              {/* Live Map */}
              <div className="rounded-xl overflow-hidden border border-slate-200 z-0 mb-6">
                <MapContainer center={[location.lat, location.lng]} zoom={13} style={{ height: '250px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Circle center={[location.lat, location.lng]} radius={500} color="red" fillColor="red" fillOpacity={0.1} />
                  <Marker position={[location.lat, location.lng]} />
                  {hospitals.map((h, i) => (
                    <Marker key={i} position={[h.lat, h.lon]} />
                  ))}
                </MapContainer>
              </div>

              {/* Nearby Hospitals List */}
              <h3 className="font-bold text-slate-800 mb-3">Nearby Medical Facilities</h3>
              {hospitals.length === 0 ? (
                <p className="text-slate-500 text-sm">No hospitals found within 5km. Please call emergency services for directions.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {hospitals.map((h, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                      <span className="text-sm text-slate-700">{h.tags.name || 'Medical Facility'}</span>
                      <a href={`https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}#map=18/${h.lat}/${h.lon}`} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs font-semibold hover:underline">Directions →</a>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
