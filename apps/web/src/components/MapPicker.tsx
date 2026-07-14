
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
