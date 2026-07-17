const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PACKAGE.JSON (Add Camera Scanner Library)
createFile('apps/web/package.json', JSON.stringify({
  name: "web", private: true, version: "0.0.0", type: "module",
  scripts: { build: "tsc && vite build" },
  dependencies: { "framer-motion": "^11.0.0", "html5-qrcode": "^2.3.8", "react": "^18.2.0", "react-dom": "^18.2.0", "react-router-dom": "^6.22.0" },
  devDependencies: {
    "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0", "postcss": "^8.4.0", "tailwindcss": "^3.4.0", "typescript": "^5.2.0", "vite": "^5.0.0"
  }
}, null, 2));

// 2. CREATE TRAVELER DASHBOARD (Fixes the routing issue)
createFile('apps/web/src/pages/TravelerDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function TravelerDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'TRAVELER') return navigate('/');
    
    fetch('http://localhost:3000/bookings/mine', { headers: { 'Authorization': \`Bearer \${token}\` } })
      .then(res => res.json()).then(data => setBookings(data));
  }, [navigate]);

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-800">My Travels</h1>
            <p className="text-slate-500 mt-1">Manage your bookings and tickets.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('/hidden-gems')} className="text-slate-600 font-semibold hover:text-indigo-600">Share a Gem</button>
            <button onClick={logout} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-100">Logout</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Upcoming Trips</h2>
          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-slate-500 mb-4">You have no upcoming trips.</p>
              <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700">Explore Tours</button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(b => (
                <div key={b.id} className="flex flex-col md:flex-row gap-4 p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                  <img src={b.tour.imageUrl} alt="" className="w-full md:w-32 h-24 object-cover rounded-lg" />
                  <div className="flex-grow">
                    <h3 className="font-bold text-lg text-slate-800">{b.tour.title}</h3>
                    <p className="text-sm text-slate-500">Booked on: {new Date(b.createdAt).toLocaleDateString()}</p>
                    <span className={\`mt-2 inline-block px-3 py-1 text-xs rounded-full font-semibold \${b.isCheckedIn ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700'}\`}>
                      {b.isCheckedIn ? 'Checked In' : 'Ticket Valid'}
                    </span>
                  </div>
                  <button onClick={() => navigate('/my-bookings')} className="text-indigo-600 font-semibold text-sm self-center hover:text-indigo-800">View Ticket →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`);

// 3. UPGRADE QR SCANNER (Real Camera Scanner)
createFile('apps/web/src/pages/Scanner.tsx', `
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';

export default function Scanner() {
  const navigate = useNavigate();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'ORGANIZER' && role !== 'ADMIN') {
      navigate('/');
      return;
    }

    const startScanner = async () => {
      const html5Qrcode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5Qrcode;
      
      try {
        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await html5Qrcode.stop();
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:3000/bookings/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
              body: JSON.stringify({ qrCode: decodedText })
            });
            const data = await res.json();
            if (res.ok) setResult({ success: true, message: data.message });
            else setResult({ success: false, message: data.message || 'Invalid Ticket' });
          },
          () => {}
        );
      } catch (err) { console.error(err); }
    };
    startScanner();

    return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {}); };
  }, [navigate]);

  const rescan = () => { setResult(null); window.location.reload(); };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <button onClick={() => navigate('/dashboard')} className="absolute top-8 left-8 text-slate-400 hover:text-white">← Dashboard</button>
      <h1 className="text-3xl font-bold text-white mb-8">Scan Ticket</h1>
      
      <div className="w-full max-w-md bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
        {!result ? (
          <div id="qr-reader" className="w-full aspect-square" />
        ) : (
          <div className={\`p-8 text-center aspect-square flex flex-col items-center justify-center \${result.success ? 'bg-green-900/20' : 'bg-red-900/20'}\`}>
            <div className={\`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 \${result.success ? 'bg-green-500' : 'bg-red-500'}\`}>
              {result.success ? '✓' : '✕'}
            </div>
            <h2 className={\`text-2xl font-bold mb-2 \${result.success ? 'text-green-400' : 'text-red-400'}\`}>{result.success ? 'Validated!' : 'Error'}</h2>
            <p className="text-slate-400 mb-6">{result.message}</p>
            <button onClick={rescan} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-semibold hover:bg-slate-200">Scan Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
`);

// 4. UPGRADE APP.TSX (Role-Based Routing + Premium UI)
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

function Home() {
  const [tours, setTours] = useState([]);
  const [gems, setGems] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
    fetch('http://localhost:3000/community').then(res => res.json()).then(data => setGems(data));
  }, []);

  const handleBookNow = (tour: any) => {
    if (!isLoggedIn) navigate('/login');
    else navigate('/checkout', { state: { tour } });
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
              <div className="h-56 overflow-hidden">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-indigo-600 uppercase tracking-wider font-bold">{tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1 text-slate-900">{tour.title}</h4>
                <p className="text-slate-500 mb-6 line-clamp-2 flex-grow">{tour.description}</p>
                <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-auto">
                  <span className="text-2xl font-bold text-slate-900">₹{tour.price}</span>
                  <button onClick={() => handleBookNow(tour)} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition">Book Now</button>
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
            <motion.div key={gem.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-shadow">
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

console.log('\n✨ Step 8 (Premium UI & Role Fix) successfully generated!');
