const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// FIX THE TYPO IN HOME PAGE
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
    <div className="min-h-screen bg-white selection:bg-indigo-100">
      {/* PREMIUM NAVBAR */}
      <nav className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-full px-6 py-3 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg">V</span>
          Voyagora
        </h1>
        <div className="hidden md:flex gap-8 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium flex items-center gap-1 transition">✨ AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-600 hover:text-red-700 font-medium transition">Admin</button>}
        </div>
        <button onClick={handleDashboardClick} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition shadow-md">
          {isLoggedIn ? 'Dashboard' : 'Get Started'}
        </button>
      </nav>

      {/* IMMERSIVE HERO SECTION */}
      <header className="relative h-[100vh] flex items-end overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent z-10" />
        
        <div className="relative z-20 w-full max-w-7xl mx-auto p-8 pb-24">
          <motion.div 
            initial={{ opacity: 0, y: 40 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-6 inline-block">
              🌍 The Ultimate Travel Operating System
            </span>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 tracking-tighter text-white leading-none">
              Explore the <br/><span className="text-indigo-400">Unexplored</span>
            </h2>
            <p className="text-xl text-slate-200 mb-10 max-w-xl font-light">
              Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here.
            </p>
            
            <div className="bg-white p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl">
              <div className="flex-grow flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📍</span>
                <input type="text" placeholder="Where do you want to go?" className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📅</span>
                <input type="text" placeholder="Add dates" className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                Search
              </button>
            </div>
          </motion.div>
        </div>
      </header>

      {/* TRUST BADGES */}
      <div className="bg-slate-900 py-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-around items-center gap-8 text-slate-500 text-sm font-bold uppercase tracking-wider">
          <span>⭐ 4.9/5 Traveler Rating</span>
          <span>🔒 Secure Payments</span>
          <span>🛡️ Verified Organizers</span>
          <span>⚡ Instant Confirmation</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-8 py-24">
        {/* FEATURED TOURS */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-wider mb-2 block">Curated for you</span>
            <h3 className="text-4xl font-bold text-slate-900 tracking-tight">Featured Tours</h3>
          </div>
          <button className="text-slate-600 hover:text-indigo-600 font-semibold text-sm hidden md:block">View All →</button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-32">
          {tours.map((tour: any, i) => (
            <motion.div 
              key={tour.id} 
              initial={{ opacity: 0, y: 50 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }} 
              className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col"
            >
              <div className="h-72 overflow-hidden relative">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">
                  <span className="text-lg font-bold text-slate-900">₹{tour.price}</span>
                </div>
                <span className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Tour</span>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">By {tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-3 text-slate-900">{tour.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow">{tour.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">⭐ 4.8 (240 reviews)</span>
                    <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-600 transition text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(tour)} className="text-slate-500 text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* UPCOMING EVENTS */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-purple-600 font-bold text-sm uppercase tracking-wider mb-2 block">Don't miss out</span>
            <h3 className="text-4xl font-bold text-slate-900 tracking-tight">Upcoming Events</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10 mb-32">
          {events.map((event: any, i) => (
            <motion.div 
              key={event.id} 
              initial={{ opacity: 0, y: 50 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }} 
              className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col"
            >
              <div className="h-72 overflow-hidden relative">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">
                  <span className="text-lg font-bold text-slate-900">₹{event.price}</span>
                </div>
                <span className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Event</span>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">{new Date(event.eventDate).toLocaleDateString()}</span>
                <h4 className="text-2xl font-bold mb-3 text-slate-900">{event.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow">{event.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Limited seats</span>
                    <button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-600 transition text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(event)} className="text-slate-500 text-sm hover:text-purple-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* HIDDEN GEMS */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-yellow-600 font-bold text-sm uppercase tracking-wider mb-2 block">Community Driven</span>
            <h3 className="text-4xl font-bold text-slate-900 tracking-tight">Hidden Gems 💎</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {gems.map((gem: any, i) => (
            <motion.div 
              key={gem.id} 
              initial={{ opacity: 0, scale: 0.9 }} 
              whileInView={{ opacity: 1, scale: 1 }} 
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }} 
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1" 
              onClick={() => setActiveMap(gem)}
            >
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-40 object-cover" />
              <div className="p-4">
                <h4 className="font-bold text-lg text-slate-900">{gem.name}</h4>
                <p className="text-slate-500 text-sm line-clamp-2">{gem.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* PREMIUM FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-20">
        <div className="max-w-7xl mx-auto px-8 grid md:grid-cols-4 gap-12">
          <div>
            <h1 className="text-2xl font-extrabold text-white mb-4">Voyagora<span className="text-indigo-400">.</span></h1>
            <p className="text-sm">Your Travel Operating System. Discover, book, and explore the world.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-white cursor-pointer">Tours</li>
              <li className="hover:text-white cursor-pointer">Events</li>
              <li className="hover:text-white cursor-pointer">Hidden Gems</li>
              <li className="hover:text-white cursor-pointer">AI Planner</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-white cursor-pointer">About Us</li>
              <li className="hover:text-white cursor-pointer">Careers</li>
              <li className="hover:text-white cursor-pointer">Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Newsletter</h4>
            <p className="text-sm mb-4">Get the best travel deals weekly.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email address" className="bg-slate-800 px-4 py-2 rounded-lg text-sm text-white outline-none flex-grow" />
              <button className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500">→</button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm">
          © 2024 Voyagora Ecosystem. Built for Travelers, by Travelers.
        </div>
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

console.log('\n✨ Step 16 (Typo Fix) successfully generated!');
