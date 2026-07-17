const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. CREATE MAP MODAL COMPONENT (For Travelers to view locations)
createFile('apps/web/src/components/MapModal.tsx', `
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
`);

// 2. UPGRADE ORGANIZER DASHBOARD (Sidebar + Analytics Cards)
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-indigo-400 font-semibold flex items-center gap-2">📊 Overview</button>
          <button onClick={() => navigate('/scanner')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">📷 Scanner</button>
        </nav>
        <button onClick={logout} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Welcome back, Organizer</h2>
            <p className="text-slate-500">Here's what's happening with your business today.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 flex items-center gap-2">+ Create New</button>
        </div>

        {/* Analytics Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Revenue</p>
            <h3 className="text-3xl font-bold text-slate-900">₹0</h3>
            <p className="text-green-500 text-xs mt-2">+0% from last month</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Active Tours</p>
            <h3 className="text-3xl font-bold text-slate-900">{tours.length}</h3>
            <p className="text-slate-400 text-xs mt-2">{tours.length} live listings</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Upcoming Events</p>
            <h3 className="text-3xl font-bold text-slate-900">{events.length}</h3>
            <p className="text-slate-400 text-xs mt-2">{events.length} scheduled</p>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Inventory Management</h3></div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="p-4 font-medium">Listing</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {tours.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3">
                    <img src={t.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <span className="font-medium text-slate-800">{t.title}</span>
                  </td>
                  <td className="p-4"><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">Tour</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{t.price}</td>
                </tr>
              ))}
              {events.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3">
                    <img src={e.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <span className="font-medium text-slate-800">{e.title}</span>
                  </td>
                  <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">Event</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{e.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tours.length === 0 && events.length === 0 && <p className="p-8 text-center text-slate-400">No listings yet. Click "Create New" to start.</p>}
        </div>
      </main>

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
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                  <input type="number" required placeholder="0.00" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" />
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
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300">← Back to Dashboard</button>
                  <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500">Save Listing</button>
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

// 3. UPGRADE ADMIN DASHBOARD (Premium Approval Queue)
createFile('apps/web/src/pages/AdminDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<any[]>([]);

  const fetchPending = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const res = await fetch('http://localhost:3000/community/pending', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 403) { navigate('/'); return; }
    const data = await res.json();
    setPlaces(data);
  };

  useEffect(() => { fetchPending(); }, []);

  const approve = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/community/' + id + '/approve', { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token } });
    fetchPending();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-red-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-red-400 font-semibold flex items-center gap-2">🛡️ Admin Control</button>
          <button onClick={() => navigate('/')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">🏠 View Site</button>
        </nav>
        <button onClick={() => { localStorage.clear(); navigate('/'); }} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      <main className="flex-grow p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800">Admin Control Center</h2>
          <p className="text-slate-500">Review and approve community submissions.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-800">Pending Approvals ({places.length})</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {places.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-center md:col-span-2">Queue is empty! 🎉</div>
          ) : (
            places.map(place => (
              <motion.div key={place.id} layout className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex gap-6">
                <img src={place.imageUrl} alt="" className="w-32 h-32 object-cover rounded-xl" />
                <div className="flex-grow flex flex-col">
                  <h4 className="text-xl font-bold text-slate-800">{place.name}</h4>
                  <p className="text-xs text-slate-400 mb-2">Submitted by: {place.user.name}</p>
                  <p className="text-slate-600 text-sm line-clamp-3 mb-4 flex-grow">{place.description}</p>
                  <button onClick={() => approve(place.id)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-500 w-full md:w-auto self-start">Approve & Publish</button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
`);

// 4. UPGRADE HOME PAGE (View on Map + Premium Cards)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TravelerDashboard from './pages/TravelerDashboard';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import AIPlanner from './pages/AIPlanner';
import Scanner from './pages/Scanner';
import HiddenGems from './pages/HiddenGems';
import AdminDashboard from './pages/AdminDashboard';
import MapModal from './components/MapModal';

function Home() {
  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [gems, setGems] = useState([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
    fetch('http://localhost:3000/events').then(res => res.json()).then(data => setEvents(data));
    fetch('http://localhost:3000/community').then(res => res.json()).then(data => setGems(data));
  }, []);

  const handleBookNow = (item: any, type: 'tour' | 'event') => {
    if (!isLoggedIn) navigate('/login');
    else navigate('/checkout', { state: { [type]: item } });
  };

  const handleDashboardClick = () => {
    if (!isLoggedIn) return navigate('/login');
    if (role === 'ADMIN') navigate('/admin');
    else if (role === 'ORGANIZER') navigate('/dashboard');
    else navigate('/traveler-dashboard');
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex justify-between items-center max-w-7xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Voyagora<span className="text-indigo-600">.</span></h1>
        <div className="flex gap-6 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm text-slate-600 hover:text-indigo-600 font-medium flex items-center gap-1">✨ AI</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm text-slate-600 hover:text-indigo-600 font-medium">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm text-slate-600 hover:text-indigo-600 font-medium">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-600 hover:text-red-700 font-medium">Admin</button>}
          <button onClick={handleDashboardClick} className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-800 transition">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
      </nav>

      <header className="relative h-[70vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-slate-900/40 z-10" />
        <div className="relative z-20 text-center px-4 max-w-3xl">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight text-white">
            Explore the Unexplored
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="text-xl text-slate-300 mb-8">
            Your Travel Operating System. Discover hidden gems, book local experiences, and build itineraries with AI.
          </motion.p>
          <div className="flex justify-center bg-white p-2 rounded-xl shadow-2xl">
            <input type="text" placeholder="Where do you want to go?" className="px-6 py-3 w-full max-w-md rounded-lg outline-none text-slate-900" />
            <button className="bg-indigo-600 px-8 rounded-lg font-bold text-white hover:bg-indigo-700 transition">Search</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 py-20">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h3 className="text-3xl font-bold text-slate-900">Featured Tours</h3>
            <p className="text-slate-500 mt-1">Hand-picked experiences by local organizers</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {tours.map((tour: any, i) => (
            <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group cursor-pointer flex flex-col hover:shadow-xl transition-shadow">
              <div className="h-56 overflow-hidden relative">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-indigo-600">Tour</span>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-indigo-600 uppercase tracking-wider font-bold">{tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1 text-slate-900">{tour.title}</h4>
                <p className="text-slate-500 mb-6 line-clamp-2 flex-grow">{tour.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-slate-900">₹{tour.price}</span>
                    <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(tour)} className="text-slate-500 text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-10">
          <div>
            <h3 className="text-3xl font-bold text-slate-900">Upcoming Events</h3>
            <p className="text-slate-500 mt-1">Concerts, festivals, and local meetups</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {events.map((event: any, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group cursor-pointer flex flex-col hover:shadow-xl transition-shadow">
              <div className="h-56 overflow-hidden relative">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <span className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-purple-600">Event</span>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-purple-600 uppercase tracking-wider font-bold">{new Date(event.eventDate).toLocaleDateString()}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1 text-slate-900">{event.title}</h4>
                <p className="text-slate-500 mb-6 line-clamp-2 flex-grow">{event.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-slate-900">₹{event.price}</span>
                    <button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(event)} className="text-slate-500 text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-10">
          <div>
            <h3 className="text-3xl font-bold text-slate-900">Community Hidden Gems 💎</h3>
            <p className="text-slate-500 mt-1">Unbelievable spots discovered by travelers</p>
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {gems.map((gem: any, i) => (
            <motion.div key={gem.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-shadow cursor-pointer" onClick={() => setActiveMap(gem)}>
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-32 object-cover" />
              <div className="p-4">
                <h4 className="font-bold text-lg text-slate-900">{gem.name}</h4>
                <p className="text-slate-500 text-sm line-clamp-2">{gem.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
        © 2024 Voyagora Ecosystem. Built for Travelers, by Travelers.
      </footer>

      {activeMap && (
        <MapModal lat={activeMap.lat} lng={activeMap.lng} title={activeMap.title || activeMap.name} onClose={() => setActiveMap(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/traveler-dashboard" element={<TravelerDashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/ai-planner" element={<AIPlanner />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/hidden-gems" element={<HiddenGems />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 14 (Premium UI & Map Modals) successfully generated!');
