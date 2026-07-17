const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. CREATE REVIEW MODAL COMPONENT
createFile('apps/web/src/components/ReviewModal.tsx', `
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function ReviewModal({ itemId, itemType, itemName, onClose }: { itemId: string, itemType: string, itemName: string, onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    await fetch('http://localhost:3000/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ rating, comment, [itemType + 'Id']: itemId })
    });
    setLoading(false);
    onClose();
    alert('Review submitted! Thank you.');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Leave a Review</h2>
        <p className="text-slate-500 text-sm mb-6">{itemName}</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  type="button" key={star} onClick={() => setRating(star)}
                  className={"text-3xl transition-colors " + (star <= rating ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-200')}
                >★</button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Review</label>
            <textarea 
              required value={comment} onChange={(e) => setComment(e.target.value)} 
              className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 h-24" 
              placeholder="Share your experience..." 
            />
          </div>
          
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
`);

// 2. UPDATE TRAVELER DASHBOARD (Add Leave Review Button & Modal)
createFile('apps/web/src/pages/TravelerDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReviewModal from '../components/ReviewModal';

export default function TravelerDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReview, setActiveReview] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'TRAVELER') return navigate('/');
    
    fetch('http://localhost:3000/bookings/mine', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(res => res.json()).then(data => { setBookings(data); setLoading(false); });
  }, [navigate]);

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button className="text-left text-indigo-400 font-semibold flex items-center gap-2">✈️ My Trips</button>
          <button onClick={() => navigate('/hidden-gems')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">💎 Hidden Gems</button>
          <button onClick={() => navigate('/')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">🏠 Explore</button>
        </nav>
        <button onClick={logout} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      <main className="flex-grow p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800">My Trips</h2>
          <p className="text-slate-500">Manage your upcoming adventures and share your experiences.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading your trips...</div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">🧳</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No trips booked yet</h3>
            <p className="text-slate-500 mb-6">Time to pack your bags and explore the world!</p>
            <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">Explore Tours</button>
          </div>
        ) : (
          <div className="grid gap-6">
            {bookings.map((b, i) => {
              const item = b.tour || b.event;
              const isTour = !!b.tour;
              const tripDate = isTour ? b.travelDate : b.event?.eventDate;
              
              return (
                <motion.div 
                  key={b.id} 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-shadow"
                >
                  <img src={item.imageUrl} alt={item.title} className="w-full md:w-48 h-48 object-cover" />
                  
                  <div className="p-6 flex-grow flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={isTour ? "bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold" : "bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold"}>
                          {isTour ? 'Tour' : 'Event'}
                        </span>
                        <span className={b.isCheckedIn ? "bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold" : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold"}>
                          {b.isCheckedIn ? 'Checked In' : 'Valid'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{item.title}</h3>
                      <p className="text-slate-500 text-sm mb-4">
                        {tripDate ? new Date(tripDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not specified'}
                      </p>
                      <div className="flex gap-4 text-sm text-slate-400">
                        <span>🎟️ Ticket ID: {b.id.slice(0, 8).toUpperCase()}</span>
                        <span>💰 Paid: ₹{b.totalAmount}</span>
                      </div>
                    </div>
                    
                    <div className="flex md:flex-col gap-2 md:items-end justify-between">
                      <button onClick={() => navigate('/my-bookings')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 w-full md:w-auto">
                        View Ticket
                      </button>
                      <button 
                        onClick={() => setActiveReview({ id: item.id, type: isTour ? 'tour' : 'event', name: item.title })} 
                        className="bg-white border border-indigo-200 text-indigo-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-50 w-full md:w-auto"
                      >
                        ⭐ Leave Review
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {activeReview && (
        <ReviewModal 
          itemId={activeReview.id} 
          itemType={activeReview.type} 
          itemName={activeReview.name} 
          onClose={() => setActiveReview(null)} 
        />
      )}
    </div>
  );
}
`);

// 3. UPDATE HOME PAGE (Display Real Ratings on Cards)
// We only need to update the Tour mapping section in App.tsx to show avgRating
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
import MapModal from './components/MapModal';

function Home() {
  const [tours, setTours] = useState([]);
  const [events, setEvents] = useState([]);
  const [gems, setGems] = useState([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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
    else if (role === 'ORGANIZER') {
      if (localStorage.getItem('subStatus') === 'ACTIVE') navigate('/dashboard');
      else navigate('/pricing');
    }
    else navigate('/traveler-dashboard');
  };

  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100">
      <nav className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm rounded-2xl px-4 md:px-6 py-3 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-lg">V</span>
          Voyagora
        </h1>
        <div className="hidden md:flex gap-8 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">✨ AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm text-slate-700 hover:text-indigo-600 font-medium transition">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-600 hover:text-red-700 font-medium transition">Admin</button>}
          <button onClick={handleDashboardClick} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition shadow-md">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-800 text-2xl">☰</button>
      </nav>

      {menuOpen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex flex-col gap-4 md:hidden">
          <button onClick={() => { navigate(isLoggedIn ? '/ai-planner' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">✨ AI Planner</button>
          <button onClick={() => { navigate(isLoggedIn ? '/hidden-gems' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">Hidden Gems</button>
          {isLoggedIn && <button onClick={() => { navigate('/my-bookings'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => { navigate('/admin'); setMenuOpen(false); }} className="text-left text-red-600 font-medium py-2">Admin</button>}
          <button onClick={() => { handleDashboardClick(); setMenuOpen(false); }} className="bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-semibold text-center">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
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
            <div className="bg-white p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-2xl">
              <div className="flex-grow flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📍</span>
                <input type="text" placeholder="Where do you want to go?" className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📅</span>
                <input type="text" placeholder="Add dates" className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">Search</button>
            </div>
          </motion.div>
        </div>
      </header>

      <div className="bg-slate-900 py-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-around items-center gap-4 md:gap-8 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-wider">
          <span>⭐ 4.9/5 Traveler Rating</span>
          <span>🔒 Secure Payments</span>
          <span>🛡️ Verified Organizers</span>
          <span>⚡ Instant Confirmation</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-indigo-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Curated for you</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Featured Tours</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {tours.map((tour: any, i) => (
            <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
              <div className="h-56 md:h-72 overflow-hidden relative">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{tour.price}</span></div>
                <span className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Tour</span>
              </div>
              <div className="p-5 md:p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">By {tour.organizer.name}</span>
                <h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{tour.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{tour.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    {/* DISPLAY REAL RATINGS HERE */}
                    <span className="text-slate-400 text-xs md:text-sm">⭐ {tour.avgRating || '0.0'} ({tour.reviewCount} reviews)</span>
                    <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-indigo-600 transition text-xs md:text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(tour)} className="text-slate-500 text-xs md:text-sm hover:text-indigo-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-purple-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Don't miss out</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Upcoming Events</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 mb-20 md:mb-32">
          {events.map((event: any, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
              <div className="h-56 md:h-72 overflow-hidden relative">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-base md:text-lg font-bold text-slate-900">₹{event.price}</span></div>
                <span className="absolute top-4 right-4 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Event</span>
              </div>
              <div className="p-5 md:p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">{new Date(event.eventDate).toLocaleDateString()}</span>
                <h4 className="text-xl md:text-2xl font-bold mb-3 text-slate-900">{event.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm md:text-base">{event.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-xs md:text-sm">Limited seats</span>
                    <button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold hover:bg-purple-600 transition text-xs md:text-sm">Book Now</button>
                  </div>
                  <button onClick={() => setActiveMap(event)} className="text-slate-500 text-xs md:text-sm hover:text-purple-600 font-medium flex items-center justify-center gap-1 pt-2 border-t border-dashed">📍 View on Map</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-8 md:mb-12">
          <div>
            <span className="text-yellow-600 font-bold text-xs md:text-sm uppercase tracking-wider mb-2 block">Community Driven</span>
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Hidden Gems 💎</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {gems.map((gem: any, i) => (
            <motion.div key={gem.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1" onClick={() => setActiveMap(gem)}>
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-32 md:h-40 object-cover" />
              <div className="p-3 md:p-4">
                <h4 className="font-bold text-base md:text-lg text-slate-900">{gem.name}</h4>
                <p className="text-slate-500 text-xs md:text-sm line-clamp-2">{gem.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-white mb-4">Voyagora<span className="text-indigo-400">.</span></h1>
            <p className="text-xs md:text-sm">Your Travel Operating System. Discover, book, and explore the world.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Platform</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li className="hover:text-white cursor-pointer">Tours</li><li className="hover:text-white cursor-pointer">Events</li><li className="hover:text-white cursor-pointer">Hidden Gems</li><li className="hover:text-white cursor-pointer">AI Planner</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Company</h4>
            <ul className="space-y-2 text-xs md:text-sm">
              <li className="hover:text-white cursor-pointer">About Us</li><li className="hover:text-white cursor-pointer">Careers</li><li className="hover:text-white cursor-pointer">Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">Newsletter</h4>
            <p className="text-xs md:text-sm mb-4">Get the best travel deals weekly.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email address" className="bg-slate-800 px-4 py-2 rounded-lg text-xs md:text-sm text-white outline-none flex-grow" />
              <button className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500">→</button>
            </div>
          </div>
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
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
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

console.log('\n✨ Step 24 (Reviews UI & Home Page Ratings) successfully generated!');
