const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. OVERWRITE APP.TSX (Add Category Cards & Explore Route)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TravelerDashboard from './pages/TravelerDashboard';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import MyBookings from './pages/MyBookings';
import AIPlanner from './pages/AIPlanner';
import Scanner from './pages/Scanner';
import HiddenGems from './pages/HiddenGems';
import AdminDashboard from './pages/AdminDashboard';
import Pricing from './pages/Pricing';
import Profile from './pages/Profile';
import TourDetail from './pages/TourDetail';
import SubscriptionSuccess from './pages/SubscriptionSuccess';
import Explore from './pages/Explore';
import MapModal from './components/MapModal';
import WishlistButton from './components/WishlistButton';
import NotificationBell from './components/NotificationBell';

function Home() {
  const [allTours, setAllTours] = useState<any[]>([]);
  const [filteredTours, setFilteredTours] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [gems, setGems] = useState<any[]>([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => { setAllTours(data); setFilteredTours(data); });
    fetch('http://localhost:3000/events').then(res => res.json()).then(data => setEvents(data));
    fetch('http://localhost:3000/community').then(res => res.json()).then(data => setGems(data));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    let results = allTours;
    if (searchQuery) { results = results.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase())); }
    if (maxPrice) { results = results.filter(t => t.price <= Number(maxPrice)); }
    setFilteredTours(results);
    document.getElementById('tours-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBookNow = (item: any, type: 'tour' | 'event') => {
    if (!isLoggedIn) return navigate('/login');
    if (type === 'tour') navigate('/tours/' + item.id);
    else navigate('/checkout', { state: { event: item } });
  };

  const handleDashboardClick = () => {
    if (!isLoggedIn) return navigate('/login');
    if (role === 'ADMIN') navigate('/admin');
    else if (role === 'ORGANIZER') { if (localStorage.getItem('subStatus') === 'ACTIVE') navigate('/dashboard'); else navigate('/pricing'); }
    else navigate('/traveler-dashboard');
  };

  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100">
      <nav className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl px-4 md:px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2"><span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg">V</span>Voyagora</h1>
        <div className="hidden md:flex gap-8 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">✨ AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Hidden Gems</button>
          {isLoggedIn && <NotificationBell />}
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">My Trips</button>}
          {isLoggedIn && <button onClick={() => navigate('/profile')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Profile</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-600 hover:text-red-700 font-medium transition">Admin</button>}
          <button onClick={handleDashboardClick} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition shadow-md">{isLoggedIn ? 'Dashboard' : 'Get Started'}</button>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-800 text-2xl">☰</button>
      </nav>

      {menuOpen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex flex-col gap-4 md:hidden">
          <button onClick={() => { navigate(isLoggedIn ? '/ai-planner' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">✨ AI Planner</button>
          <button onClick={() => { navigate(isLoggedIn ? '/hidden-gems' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">Hidden Gems</button>
          {isLoggedIn && <div className="py-2 flex items-center gap-2"><NotificationBell /> <span className="text-slate-700 font-medium">Notifications</span></div>}
          {isLoggedIn && <button onClick={() => { navigate('/my-bookings'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">My Trips</button>}
          {isLoggedIn && <button onClick={() => { navigate('/profile'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">Profile</button>}
          {role === 'ADMIN' && <button onClick={() => { navigate('/admin'); setMenuOpen(false); }} className="text-left text-red-600 font-medium py-2">Admin</button>}
          <button onClick={() => { handleDashboardClick(); setMenuOpen(false); }} className="bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-semibold text-center">{isLoggedIn ? 'Dashboard' : 'Get Started'}</button>
        </div>
      )}

      <header className="relative h-[100vh] flex items-end overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
        <div className="relative z-20 w-full max-w-7xl mx-auto p-4 md:p-8 pb-24">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-3xl">
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6 inline-block">🌍 The Ultimate Travel Operating System</span>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tighter text-white leading-none">Explore the <br/><span className="text-indigo-400">Unexplored</span></h2>
            <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-xl font-light">Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here.</p>
            <form onSubmit={handleSearch} className="bg-white p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl">
              <div className="flex-grow flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100"><span className="text-slate-400">📍</span><input type="text" placeholder="Where do you want to go?" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" /></div>
              <div className="flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100"><span className="text-slate-400">💰</span><input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" /></div>
              <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">Search</button>
            </form>
          </motion.div>
        </div>
      </header>

      {/* NEW CATEGORY CARDS SECTION */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <a href="/explore/tours" target="_blank" rel="noreferrer" className="bg-indigo-50 p-8 rounded-2xl text-center hover:bg-indigo-100 transition cursor-pointer group">
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎒</div>
            <h3 className="text-xl font-bold text-indigo-800">Travel Packages</h3>
            <p className="text-indigo-600 text-sm mt-2">Curated trips and adventures</p>
          </a>
          <a href="/explore/events" target="_blank" rel="noreferrer" className="bg-purple-50 p-8 rounded-2xl text-center hover:bg-purple-100 transition cursor-pointer group">
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎉</div>
            <h3 className="text-xl font-bold text-purple-800">Upcoming Events</h3>
            <p className="text-purple-600 text-sm mt-2">Concerts, festivals, and local meetups</p>
          </a>
          <a href="/explore/gems" target="_blank" rel="noreferrer" className="bg-yellow-50 p-8 rounded-2xl text-center hover:bg-yellow-100 transition cursor-pointer group">
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">💎</div>
            <h3 className="text-xl font-bold text-yellow-800">Hidden Gems</h3>
            <p className="text-yellow-600 text-sm mt-2">Unbelievable spots by travelers</p>
          </a>
        </div>
      </section>

      <div className="bg-slate-900 py-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-around items-center gap-4 md:gap-8 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-wider">
          <span>⭐ 4.9/5 Traveler Rating</span><span>🔒 Secure Payments</span><span>🛡️ Verified Organizers</span><span>⚡ Instant Confirmation</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div id="tours-section" className="flex justify-between items-end mb-8 md:mb-12"><div><span className="text-indigo-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Curated for you</span><h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Featured Tours</h3></div></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {filteredTours.length === 0 ? (<div className="col-span-full text-center py-12 text-slate-500">No tours found matching your search.</div>) : (
            filteredTours.map((tour: any, i) => (
              <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
                <div className="h-56 md:h-72 overflow-hidden relative"><img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{tour.price}</span></div><WishlistButton itemId={tour.id} itemType="tour" /></div>
                <div className="p-5 md:p-6 flex-grow flex flex-col"><span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">By {tour.organizer.name}</span><h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{tour.title}</h4><p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{tour.description}</p><div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto"><div className="flex justify-between items-center"><span className="text-slate-400 text-xs md:text-sm">⭐ {tour.avgRating || '0.0'} ({tour.reviewCount} reviews)</span><button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-indigo-600 transition text-xs md:text-sm">Book Now</button></div><button onClick={() => setActiveMap(tour)} className="text-slate-500 text-xs md:text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button></div></div>
              </motion.div>
            ))
          )}
        </div>

        <div className="flex justify-between items-end mb-8 md:mb-12"><div><span className="text-purple-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Don't miss out</span><h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Upcoming Events</h3></div></div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {events.map((event: any, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
              <div className="h-56 md:h-72 overflow-hidden relative"><img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /><div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{event.price}</span></div><WishlistButton itemId={event.id} itemType="event" /></div>
              <div className="p-5 md:p-6 flex-grow flex flex-col"><span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">{new Date(event.eventDate).toLocaleDateString()}</span><h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{event.title}</h4><p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{event.description}</p><div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto"><div className="flex justify-between items-center"><span className="text-slate-400 text-xs md:text-sm">Limited seats</span><button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-purple-600 transition text-xs md:text-sm">Book Now</button></div><button onClick={() => setActiveMap(event)} className="text-slate-500 text-xs md:text-sm hover:text-purple-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button></div></div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-8 md:mb-12"><div><span className="text-yellow-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Community Driven</span><h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Hidden Gems 💎</h3></div></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {gems.map((gem: any, i) => (
            <motion.div key={gem.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1" onClick={() => setActiveMap(gem)}>
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-32 md:h-40 object-cover" /><div className="p-3 md:p-4"><h4 className="font-bold text-base md:text-lg text-slate-900">{gem.name}</h4><p className="text-slate-500 text-xs md:text-sm line-clamp-2">{gem.description}</p></div>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1"><h1 className="text-xl md:text-2xl font-extrabold text-white mb-4">Voyagora<span className="text-indigo-400">.</span></h1><p className="text-xs md:text-sm">Your Travel Operating System. Discover, book, and explore the world.</p></div>
          <div><h4 className="text-white font-bold mb-4 text-sm md:text-base">Platform</h4><ul className="space-y-2 text-xs md:text-sm"><li className="hover:text-white cursor-pointer">Tours</li><li className="hover:text-white cursor-pointer">Events</li><li className="hover:text-white cursor-pointer">Hidden Gems</li><li className="hover:text-white cursor-pointer">AI Planner</li></ul></div>
          <div><h4 className="text-white font-bold mb-4 text-sm md:text-base">Company</h4><ul className="space-y-2 text-xs md:text-sm"><li className="hover:text-white cursor-pointer">About Us</li><li className="hover:text-white cursor-pointer">Careers</li><li className="hover:text-white cursor-pointer">Contact</li></ul></div>
          <div><h4 className="text-white font-bold mb-4 text-sm md:text-base">Newsletter</h4><p className="text-xs md:text-sm mb-4">Get the best travel deals weekly.</p><div className="flex gap-2"><input type="email" placeholder="Email address" className="bg-slate-800 px-4 py-2 rounded-lg text-xs md:text-sm text-white outline-none flex-grow" /><button className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500">→</button></div></div>
        </div>
        <div className="border-t border-slate-800 mt-8 md:mt-12 pt-8 text-center text-xs md:text-sm">© 2024 Voyagora Ecosystem. Built for Travelers, by Travelers.</div>
      </footer>

      {activeMap && ( <MapModal lat={activeMap.lat} lng={activeMap.lng} title={activeMap.title || activeMap.name} onClose={() => setActiveMap(null)} /> )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore/:type" element={<Explore />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth/activate-subscription" element={<SubscriptionSuccess />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/tours/:id" element={<TourDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/traveler-dashboard" element={<TravelerDashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
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

// 2. UPDATE DASHBOARD.TSX (Add Delete Button & Logic)
createFile('apps/web/src/pages/Dashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MapPicker from '../components/MapPicker';
import ImageUpload from '../components/ImageUpload';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tours, setTours] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, activeTours: 0, upcomingEvents: 0, chartData: [] });
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('TOUR');
  const [formData, setFormData] = useState({ title: '', description: '', price: 0, imageUrl: '', gallery: [] as string[], lat: 0, lng: 0, eventDate: '', paymentType: 'FULL', advanceAmount: 0, gstNumber: '', gstPercentage: 0 });

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const tRes = await fetch('http://localhost:3000/tours'); setTours(await tRes.json());
    const eRes = await fetch('http://localhost:3000/events'); setEvents(await eRes.json());
    const sRes = await fetch('http://localhost:3000/tours/stats', { headers: { 'Authorization': 'Bearer ' + token } });
    setStats(await sRes.json());
  };
  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const endpoint = type === 'TOUR' ? 'tours' : 'events';
    await fetch('http://localhost:3000/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(formData) });
    setShowForm(false);
    setFormData({ title: '', description: '', price: 0, imageUrl: '', gallery: [], lat: 0, lng: 0, eventDate: '', paymentType: 'FULL', advanceAmount: 0, gstNumber: '', gstPercentage: 0 });
    fetchData();
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('Are you sure you want to delete this listing? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/' + type + '/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
    fetchData();
  };

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-indigo-400 font-semibold flex items-center gap-2">📊 Overview</button>
          <button onClick={() => navigate('/scanner')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">📷 Scanner</button>
        </nav>
        <button onClick={logout} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      <main className="flex-grow p-8">
        <div className="flex justify-between items-center mb-8">
          <div><h2 className="text-3xl font-bold text-slate-800">Welcome back, Organizer</h2><p className="text-slate-500">Here's what's happening with your business today.</p></div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500">+ Create New</button>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-slate-500 text-sm mb-1">Total Revenue</p><h3 className="text-3xl font-bold text-slate-900">₹{stats.totalRevenue.toLocaleString()}</h3></div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-slate-500 text-sm mb-1">Total Bookings</p><h3 className="text-3xl font-bold text-slate-900">{stats.totalBookings}</h3></div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-slate-500 text-sm mb-1">Active Tours</p><h3 className="text-3xl font-bold text-slate-900">{stats.activeTours}</h3></div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-slate-500 text-sm mb-1">Upcoming Events</p><h3 className="text-3xl font-bold text-slate-900">{stats.upcomingEvents}</h3></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-10">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue (Last 7 Days)</h3>
          <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }} /><Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} /></LineChart></ResponsiveContainer></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Inventory Management</h3></div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm"><tr><th className="p-4 font-medium">Listing</th><th className="p-4 font-medium">Type</th><th className="p-4 font-medium">Price</th><th className="p-4 font-medium">Payment</th><th className="p-4 font-medium">Action</th></tr></thead>
            <tbody>
              {tours.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={t.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{t.title}</span></td>
                  <td className="p-4"><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">Tour</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{t.price}</td>
                  <td className="p-4 text-slate-600 text-sm">{t.paymentType === 'ADVANCE' ? 'Advance: ₹'+t.advanceAmount : 'Full'}</td>
                  <td className="p-4"><button onClick={() => handleDelete('tours', t.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Delete</button></td>
                </tr>
              ))}
              {events.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={e.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{e.title}</span></td>
                  <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">Event</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{e.price}</td>
                  <td className="p-4 text-slate-600 text-sm">{e.paymentType === 'ADVANCE' ? 'Advance: ₹'+e.advanceAmount : 'Full'}</td>
                  <td className="p-4"><button onClick={() => handleDelete('events', e.id)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Delete</button></td>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span><input type="number" required placeholder="Total Price" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" /></div>
                  <input type="number" placeholder="GST %" value={formData.gstPercentage || ''} onChange={(e) => setFormData({ ...formData, gstPercentage: Number(e.target.value) })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
                </div>
                <input type="text" placeholder="GST Number (Optional)" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
                {type === 'EVENT' && <input type="datetime-local" required value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />}
                <div className="border-t border-slate-200 pt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Options</label>
                  <div className="flex gap-4 mb-4">
                    <button type="button" onClick={() => setFormData({ ...formData, paymentType: 'FULL' })} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (formData.paymentType === 'FULL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>Full Payment</button>
                    <button type="button" onClick={() => setFormData({ ...formData, paymentType: 'ADVANCE' })} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (formData.paymentType === 'ADVANCE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600')}>Advance Only</button>
                  </div>
                  {formData.paymentType === 'ADVANCE' && (<div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span><input type="number" required placeholder="Advance Amount to pay online" value={formData.advanceAmount || ''} onChange={(e) => setFormData({ ...formData, advanceAmount: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" /></div>)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cover Image</label>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />}
                  <ImageUpload onUpload={(url) => setFormData({ ...formData, imageUrl: url as string })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gallery Images (Optional)</label>
                  <div className="flex flex-wrap gap-2 mb-2">{formData.gallery.map((img, i) => <img key={i} src={img} className="w-16 h-16 object-cover rounded-lg" />)}</div>
                  <ImageUpload multiple={true} onUpload={(urls) => setFormData({ ...formData, gallery: [...formData.gallery, ...(urls as string[])] })} />
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

console.log('\n✨ Step 57 (Categories UI & Dashboard Delete) successfully generated!');
