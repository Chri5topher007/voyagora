const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Restored ' + filePath);
}

// 1. RESTORE PREMIUM APP.TSX (With Categories, Stats, Serach, and Perfect Routes)
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
import GemDetail from './pages/GemDetail';
import EventDetail from './pages/EventDetail';
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
    else navigate('/events/' + item.id);
  };

  const handleDashboardClick = () => {
    if (!isLoggedIn) return navigate('/login');
    if (role === 'ADMIN') navigate('/admin');
    else if (role === 'ORGANIZER') { if (localStorage.getItem('subStatus') === 'ACTIVE') navigate('/dashboard'); else navigate('/pricing'); }
    else navigate('/traveler-dashboard');
  };

  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100 font-sans">
      <nav className="absolute top-0 left-0 right-0 z-50 w-full bg-transparent py-4 px-4 md:px-12 flex justify-between items-center">
        <h1 className="text-2xl font-serif font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-lg">
          <span className="bg-indigo-600 text-white w-9 h-9 rounded-lg flex items-center justify-center text-lg font-sans">V</span>
          Voyagora
        </h1>
        <div className="hidden md:flex gap-10 items-center text-white drop-shadow-lg">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="text-sm hover:text-indigo-400 font-medium transition font-sans">AI Planner</button>
          <button onClick={() => navigate(isLoggedIn ? '/hidden-gems' : '/login')} className="text-sm hover:text-indigo-400 font-medium transition font-sans">Hidden Gems</button>
          {isLoggedIn && <NotificationBell />}
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="text-sm hover:text-indigo-400 font-medium transition font-sans">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => navigate('/admin')} className="text-sm text-red-400 hover:text-red-300 font-medium transition font-sans">Admin</button>}
          <button onClick={handleDashboardClick} className="bg-white text-slate-900 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-600 hover:text-white transition shadow-md font-sans">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white text-3xl drop-shadow-lg">☰</button>
      </nav>

      {menuOpen && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 flex flex-col gap-4 md:hidden">
          <button onClick={() => { navigate(isLoggedIn ? '/ai-planner' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">AI Planner</button>
          <button onClick={() => { navigate(isLoggedIn ? '/hidden-gems' : '/login'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">Hidden Gems</button>
          {isLoggedIn && <div className="py-2 flex items-center gap-2"><NotificationBell /> <span className="text-slate-700 font-medium">Notifications</span></div>}
          {isLoggedIn && <button onClick={() => { navigate('/my-bookings'); setMenuOpen(false); }} className="text-left text-slate-700 font-medium py-2">My Trips</button>}
          {role === 'ADMIN' && <button onClick={() => { navigate('/admin'); setMenuOpen(false); }} className="text-left text-red-600 font-medium py-2">Admin</button>}
          <button onClick={() => { handleDashboardClick(); setMenuOpen(false); }} className="bg-slate-900 text-white px-5 py-3 rounded-full text-sm font-semibold text-center">{isLoggedIn ? 'Dashboard' : 'Get Started'}</button>
        </div>
      )}

      <header className="relative h-[100vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-slate-900/20 z-10" />
        <div className="relative z-20 w-full max-w-5xl mx-auto p-4 md:p-8 text-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full mb-8 inline-block uppercase tracking-widest font-sans">Explore the World with Voyagora</span>
            <h2 className="text-5xl md:text-8xl font-serif font-bold mb-6 text-white leading-tight drop-shadow-2xl">Let's Go <br/> <span className="text-indigo-400">Somewhere</span> Amazing</h2>
            <p className="text-lg md:text-2xl text-slate-200 mb-12 max-w-2xl mx-auto font-light font-sans">Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here.</p>
            
            <form onSubmit={handleSearch} className="bg-white p-2 rounded-2xl shadow-2xl flex flex-col md:flex-row gap-2 max-w-3xl mx-auto font-sans">
              <div className="flex-grow flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">📍</span>
                <input type="text" placeholder="Where to?" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-b md:border-b-0 md:border-r border-slate-100">
                <span className="text-slate-400">💰</span>
                <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full outline-none text-slate-800 placeholder-slate-400 text-sm" />
              </div>
              <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm">Search</button>
            </form>
          </motion.div>
        </div>
      </header>

      <section className="bg-slate-900 text-white py-12 px-4 md:px-12 border-b border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center font-sans">
          <div><h3 className="text-4xl font-serif font-bold text-indigo-400">500+</h3><p className="text-slate-400 text-sm mt-1 uppercase tracking-wider">Destinations</p></div>
          <div><h3 className="text-4xl font-serif font-bold text-indigo-400">10k+</h3><p className="text-slate-400 text-sm mt-1 uppercase tracking-wider">Happy Travelers</p></div>
          <div><h3 className="text-4xl font-serif font-bold text-indigo-400">250+</h3><p className="text-slate-400 text-sm mt-1 uppercase tracking-wider">Tour Packages</p></div>
          <div><h3 className="text-4xl font-serif font-bold text-indigo-400">4.9★</h3><p className="text-slate-400 text-sm mt-1 uppercase tracking-wider">Average Rating</p></div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 font-sans">
        <div className="text-center mb-12">
          <span className="text-indigo-600 font-bold text-sm uppercase tracking-widest">Top Categories</span>
          <h3 className="text-4xl font-serif font-bold text-slate-900 mt-2">Browse by Category</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div onClick={() => navigate('/explore/tours')} className="relative h-64 rounded-2xl overflow-hidden group cursor-pointer shadow-lg">
            <img src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Tours" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
              <h3 className="text-2xl font-serif font-bold text-white">Travel Packages</h3>
              <p className="text-slate-200 text-sm">Curated trips and adventures</p>
            </div>
          </div>
          <div onClick={() => navigate('/explore/events')} className="relative h-64 rounded-2xl overflow-hidden group cursor-pointer shadow-lg">
            <img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Events" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
              <h3 className="text-2xl font-serif font-bold text-white">Upcoming Events</h3>
              <p className="text-slate-200 text-sm">Concerts, festivals, and meetups</p>
            </div>
          </div>
          <div onClick={() => navigate('/explore/gems')} className="relative h-64 rounded-2xl overflow-hidden group cursor-pointer shadow-lg">
            <img src="https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Gems" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
              <h3 className="text-2xl font-serif font-bold text-white">Hidden Gems</h3>
              <p className="text-slate-200 text-sm">Unbelievable spots by travelers</p>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12 font-sans">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-widest">Curated for you</span>
            <h3 className="text-4xl font-serif font-bold text-slate-900 mt-2">Featured Tours</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {filteredTours.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-500 font-sans">No tours found matching your search.</div>
          ) : (
            filteredTours.map((tour: any, i) => (
              <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-2xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2 flex flex-col">
                <div className="h-64 overflow-hidden relative">
                  <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-lg font-bold text-slate-900 font-sans">₹{tour.price}</span></div>
                  <WishlistButton itemId={tour.id} itemType="tour" />
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">By {tour.organizer.name}</span>
                  <h4 className="text-2xl font-serif font-bold mb-3 text-slate-900">{tour.title}</h4>
                  <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm">{tour.description}</p>
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">⭐ {tour.avgRating || '0.0'} ({tour.reviewCount} reviews)</span>
                      <button onClick={() => handleBookNow(tour, 'tour')} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-indigo-600 transition text-sm">View Details</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <section className="bg-slate-50 py-16 px-8 rounded-3xl mb-24">
          <div className="text-center mb-12">
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-widest">Why Voyagora</span>
            <h3 className="text-4xl font-serif font-bold text-slate-900 mt-2">Travel with Confidence</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-12 text-center font-sans">
            <div><div className="text-5xl mb-4">🛡️</div><h4 className="text-xl font-bold text-slate-900 mb-2">Verified Organizers</h4><p className="text-slate-500 text-sm">Every tour operator is vetted to ensure quality and safety.</p></div>
            <div><div className="text-5xl mb-4">🔒</div><h4 className="text-xl font-bold text-slate-900 mb-2">Secure Payments</h4><p className="text-slate-500 text-sm">Bank-level encryption and Stripe integration for peace of mind.</p></div>
            <div><div className="text-5xl mb-4">⚡</div><h4 className="text-xl font-bold text-slate-900 mb-2">Instant Confirmation</h4><p className="text-slate-500 text-sm">Get QR code tickets delivered to your dashboard instantly.</p></div>
          </div>
        </section>

        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-purple-600 font-bold text-sm uppercase tracking-widest">Don't miss out</span>
            <h3 className="text-4xl font-serif font-bold text-slate-900 mt-2">Upcoming Events</h3>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {events.map((event: any, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }} className="bg-white rounded-2xl overflow-hidden border border-slate-100 group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2 flex flex-col">
              <div className="h-64 overflow-hidden relative">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg"><span className="text-lg font-bold text-slate-900 font-sans">₹{event.price}</span></div>
                <WishlistButton itemId={event.id} itemType="event" />
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">{new Date(event.eventDate).toLocaleDateString()}</span>
                <h4 className="text-2xl font-serif font-bold mb-3 text-slate-900">{event.title}</h4>
                <p className="text-slate-600 mb-6 line-clamp-2 flex-grow text-sm">{event.description}</p>
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Limited seats</span>
                    <button onClick={() => handleBookNow(event, 'event')} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-purple-600 transition text-sm">View Details</button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-yellow-600 font-bold text-sm uppercase tracking-widest">Community Driven</span>
            <h3 className="text-4xl font-serif font-bold text-slate-900 mt-2">Hidden Gems 💎</h3>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {gems.map((gem: any, i) => (
            <motion.div key={gem.id} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1" onClick={() => navigate('/gems/' + gem.id)}>
              <img src={gem.imageUrl} alt={gem.name} className="w-full h-40 object-cover" />
              <div className="p-4">
                <h4 className="font-serif font-bold text-lg text-slate-900">{gem.name}</h4>
                <p className="text-slate-500 text-sm line-clamp-2 font-sans">{gem.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-16 font-sans">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <h1 className="text-2xl font-serif font-bold text-white mb-4">Voyagora</h1>
            <p className="text-sm">Your Travel Operating System. Discover, book, and explore the world.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-white cursor-pointer">Tours</li><li className="hover:text-white cursor-pointer">Events</li><li className="hover:text-white cursor-pointer">Hidden Gems</li><li className="hover:text-white cursor-pointer">AI Planner</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              <li className="hover:text-white cursor-pointer">About Us</li><li className="hover:text-white cursor-pointer">Careers</li><li className="hover:text-white cursor-pointer">Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Newsletter</h4>
            <p className="text-sm mb-4">Get the best travel deals weekly.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email address" className="bg-slate-800 px-4 py-2 rounded-lg text-sm text-white outline-none flex-grow" />
              <button className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500">→</button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm">© 2024 Voyagora Ecosystem. Built for Travelers, by Travelers.</div>
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
        <Route path="/gems/:id" element={<GemDetail />} />
        <Route path="/events/:id" element={<EventDetail />} />
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

// 2. RESTORE EXPLORE.TSX (Navigate to details perfectly)
createFile('apps/web/src/pages/Explore.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Explore() {
  const params = useParams();
  const type = params.type || 'tours';
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const titles: any = { tours: 'Travel Packages', events: 'Upcoming Events', gems: 'Hidden Gems' };

  useEffect(() => {
    setLoading(true);
    let url = 'http://localhost:3000/' + (type === 'gems' ? 'community' : type);
    if (type === 'tours' && (searchQuery || maxPrice)) {
      url += '?';
      if (searchQuery) url += 'search=' + encodeURIComponent(searchQuery) + '&';
      if (maxPrice) url += 'maxPrice=' + maxPrice;
    }
    fetch(url).then(res => res.json()).then(data => {
      let filtered = data;
      if (type === 'events' && dateFilter) filtered = data.filter((e: any) => new Date(e.eventDate).toISOString().split('T')[0] === dateFilter);
      if (type === 'gems' && searchQuery) filtered = data.filter((g: any) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
      setItems(filtered);
      setLoading(false);
    });
  }, [type, searchQuery, maxPrice, dateFilter]);

  const handleCardClick = (item: any) => {
    if (type === 'tours') navigate('/tours/' + item.id);
    else if (type === 'events') navigate('/events/' + item.id);
    else if (type === 'gems') navigate('/gems/' + item.id);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white py-16 px-8">
        <div className="max-w-7xl mx-auto">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white mb-4 flex items-center gap-2">← Back to Home</button>
          <h1 className="text-4xl md:text-5xl font-serif font-extrabold mb-2">{titles[type]}</h1>
          <p className="text-slate-400">Find your next adventure. Filter by location, price, or date.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-wrap gap-4 items-center">
          {(type === 'tours' || type === 'gems') && (
            <input type="text" placeholder="Search by name or place..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-grow p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm min-w-[200px]" />
          )}
          {type === 'tours' && (
            <input type="number" placeholder="Max Price (₹)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-40 p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm" />
          )}
          {type === 'events' && (
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm" />
          )}
        </div>

        {loading ? <div className="text-center py-12 text-slate-500">Loading...</div> : (
          items.length === 0 ? <div className="text-center py-12 text-slate-500">No items found matching your filters.</div> : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => handleCardClick(item)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col hover:shadow-lg transition cursor-pointer">
                  <img src={item.imageUrl} alt={item.title || item.name} className="w-full h-48 object-cover" />
                  <div className="p-5 flex-grow flex flex-col">
                    <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">{item.title || item.name}</h3>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2 flex-grow">{item.description}</p>
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                      <span className="font-bold text-slate-900">{item.price ? '₹' + item.price : (item.eventDate ? new Date(item.eventDate).toLocaleDateString() : 'Community Gem')}</span>
                      <span className="text-indigo-600 text-sm font-semibold">View Details →</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
`);

console.log('\n✨ UI Restored Successfully!');
