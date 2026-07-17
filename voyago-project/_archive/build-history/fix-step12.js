const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FIX MAIN.TS (Remove Destination Seeding)
createFile('apps/api/src/main.ts', `
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  await app.listen(3000);
  console.log('🚀 Voyagora API running on http://localhost:3000');
}
bootstrap();
`);

// 2. FIX APP.CONTROLLER.TS (Remove Destination Route)
createFile('apps/api/src/app.controller.ts', `
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return { status: 'ok', message: 'Voyagora API is running' };
  }
}
`);

// 3. UPDATE APP.TSX (Remove Destination fetch from Home page)
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
  const [events, setEvents] = useState([]);
  const [gems, setGems] = useState([]);
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
              <div className="h-56 overflow-hidden">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-indigo-600 uppercase tracking-wider font-bold">{tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1 text-slate-900">{tour.title}</h4>
                <p className="text-slate-500 mb-6 line-clamp-2 flex-grow">{tour.description}</p>
                <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-auto">
                  <span className="text-2xl font-bold text-slate-900">₹{tour.price}</span>
                  <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition">Book Now</button>
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
              <div className="h-56 overflow-hidden">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-purple-600 uppercase tracking-wider font-bold">{new Date(event.eventDate).toLocaleDateString()}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1 text-slate-900">{event.title}</h4>
                <p className="text-slate-500 mb-6 line-clamp-2 flex-grow">{event.description}</p>
                <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-auto">
                  <span className="text-2xl font-bold text-slate-900">₹{event.price}</span>
                  <button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 transition">Book Now</button>
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

console.log('\n✨ Step 12 (Destination Cleanup) successfully generated!');
