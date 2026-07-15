const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'uploads'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

// STEP 1: REPAIR ALL BROKEN API URLS IN ALL FILES
const files = walk('apps/web/src');
let fixedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Fix any broken regex artifacts
  content = content.split("(import.meta.env.VITE_API_URL || 'http://localhost:3000')").join("http://localhost:3000");
  content = content.split("import.meta.env.VITE_API_URL").join("http://localhost:3000");
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('🔧 Repaired API URL in: ' + file);
    fixedCount++;
  }
});

console.log(`✅ Repaired ${fixedCount} files.`);

// STEP 2: REWRITE TRAVELER DASHBOARD (With Floating Round SOS Button)
fs.writeFileSync('apps/web/src/pages/TravelerDashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ReviewModal from '../components/ReviewModal';
import SOSModal from '../components/SOSModal';

export default function TravelerDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('TRIPS');
  const [bookings, setBookings] = useState<any[]>([]);
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReview, setActiveReview] = useState<any>(null);
  const [showSOS, setShowSOS] = useState(false);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role !== 'TRAVELER') return navigate('/');
    
    const bRes = await fetch('http://localhost:3000/bookings/mine', { headers: { 'Authorization': 'Bearer ' + token } });
    setBookings(await bRes.json());
    
    const wRes = await fetch('http://localhost:3000/wishlist/mine', { headers: { 'Authorization': 'Bearer ' + token } });
    setWishlist(await wRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [navigate]);

  const logout = () => { localStorage.clear(); navigate('/'); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button onClick={() => setTab('TRIPS')} className={"text-left font-semibold flex items-center gap-2 " + (tab === 'TRIPS' ? 'text-indigo-400' : 'text-slate-400 hover:text-white')}>✈️ My Trips</button>
          <button onClick={() => setTab('SAVED')} className={"text-left font-semibold flex items-center gap-2 " + (tab === 'SAVED' ? 'text-indigo-400' : 'text-slate-400 hover:text-white')}>❤️ Saved</button>
          <button onClick={() => navigate('/hidden-gems')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">💎 Hidden Gems</button>
          <button onClick={() => navigate('/')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">🏠 Explore</button>
        </nav>
        <button onClick={logout} className="text-left text-red-400 hover:text-red-300 flex items-center gap-2 mt-auto">🚪 Logout</button>
      </aside>

      <main className="flex-grow p-8 relative">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{tab === 'TRIPS' ? 'My Trips' : 'Saved Items'}</h2>
            <p className="text-slate-500">{tab === 'TRIPS' ? 'Manage your upcoming adventures.' : 'Trips you want to take in the future.'}</p>
          </div>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl md:hidden">
            <button onClick={() => setTab('TRIPS')} className={"px-4 py-2 rounded-lg text-sm font-semibold " + (tab === 'TRIPS' ? 'bg-white shadow-sm' : 'text-slate-600')}>Trips</button>
            <button onClick={() => setTab('SAVED')} className={"px-4 py-2 rounded-lg text-sm font-semibold " + (tab === 'SAVED' ? 'bg-white shadow-sm' : 'text-slate-600')}>Saved</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : tab === 'TRIPS' ? (
          bookings.length === 0 ? (
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
                  <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-shadow">
                    <img src={item.imageUrl} alt={item.title} className="w-full md:w-48 h-48 object-cover" />
                    <div className="p-6 flex-grow flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={isTour ? "bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold" : "bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold"}>{isTour ? 'Tour' : 'Event'}</span>
                          <span className={b.isCheckedIn ? "bg-slate-200 text-slate-600 px-2 py-1 rounded text-xs font-bold" : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold"}>{b.isCheckedIn ? 'Checked In' : 'Valid'}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-1">{item.title}</h3>
                        <p className="text-slate-500 text-sm mb-4">{tripDate ? new Date(tripDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not specified'}</p>
                      </div>
                      <div className="flex md:flex-col gap-2 md:items-end justify-between">
                        <button onClick={() => navigate('/my-bookings')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 w-full md:w-auto">View Ticket</button>
                        <button onClick={() => setActiveReview({ id: item.id, type: isTour ? 'tour' : 'event', name: item.title })} className="bg-white border border-indigo-200 text-indigo-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-50 w-full md:w-auto">⭐ Leave Review</button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          wishlist.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
              <div className="text-5xl mb-4">❤️</div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No saved items yet</h3>
              <p className="text-slate-500 mb-6">Tap the heart icon on tours to save them for later!</p>
              <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">Discover Tours</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlist.map((w, i) => {
                const item = w.tour || w.event;
                if (!item) return null;
                const isTour = !!w.tour;
                return (
                  <motion.div key={w.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-40 object-cover" />
                    <div className="p-4 flex-grow flex flex-col">
                      <span className="text-xs text-slate-500 uppercase font-bold mb-1">{isTour ? 'Tour' : 'Event'}</span>
                      <h4 className="font-bold text-lg text-slate-900 mb-2">{item.title}</h4>
                      <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                        <span className="text-lg font-bold text-slate-900">₹{item.price}</span>
                        <button onClick={() => navigate('/checkout', { state: { [isTour ? 'tour' : 'event']: item } })} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">Book Now</button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}
        
        {/* SMALL FLOATING ROUND SOS BUTTON */}
        <button 
          onClick={() => setShowSOS(true)} 
          className="fixed bottom-8 right-8 bg-red-600 text-white w-14 h-14 rounded-full shadow-2xl shadow-red-600/40 flex items-center justify-center text-xl font-bold hover:bg-red-700 transition-all hover:scale-110 z-40"
          title="Emergency SOS"
        >
          🆘
        </button>
      </main>

      {activeReview && (
        <ReviewModal itemId={activeReview.id} itemType={activeReview.type} itemName={activeReview.name} onClose={() => setActiveReview(null)} />
      )}

      {showSOS && <SOSModal onClose={() => setShowSOS(false)} />}
    </div>
  );
}
`);
console.log('✅ Traveler Dashboard restored with Round SOS button.');

console.log('\n✨ Deep Fix Complete! All URLs repaired and SOS button updated.');
