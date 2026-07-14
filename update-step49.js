const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. OVERWRITE DASHBOARD.TSX (With Gallery Uploads)
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
  const [formData, setFormData] = useState({ 
    title: '', description: '', price: 0, imageUrl: '', gallery: [] as string[], lat: 0, lng: 0, eventDate: '',
    paymentType: 'FULL', advanceAmount: 0, gstNumber: '', gstPercentage: 0
  });

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
    await fetch('http://localhost:3000/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(formData)
    });
    setShowForm(false);
    setFormData({ title: '', description: '', price: 0, imageUrl: '', gallery: [], lat: 0, lng: 0, eventDate: '', paymentType: 'FULL', advanceAmount: 0, gstNumber: '', gstPercentage: 0 });
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
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Welcome back, Organizer</h2>
            <p className="text-slate-500">Here's what's happening with your business today.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500">+ Create New</button>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Revenue</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{stats.totalRevenue.toLocaleString()}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Bookings</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalBookings}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Active Tours</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.activeTours}</h3>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Upcoming Events</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.upcomingEvents}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-10">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue (Last 7 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Inventory Management</h3></div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr><th className="p-4 font-medium">Listing</th><th className="p-4 font-medium">Type</th><th className="p-4 font-medium">Price</th><th className="p-4 font-medium">Payment</th></tr>
            </thead>
            <tbody>
              {tours.map(t => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={t.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{t.title}</span></td>
                  <td className="p-4"><span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">Tour</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{t.price}</td>
                  <td className="p-4 text-slate-600 text-sm">{t.paymentType === 'ADVANCE' ? 'Advance: ₹'+t.advanceAmount : 'Full'}</td>
                </tr>
              ))}
              {events.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-4 flex items-center gap-3"><img src={e.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" /><span className="font-medium text-slate-800">{e.title}</span></td>
                  <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">Event</span></td>
                  <td className="p-4 font-bold text-slate-900">₹{e.price}</td>
                  <td className="p-4 text-slate-600 text-sm">{e.paymentType === 'ADVANCE' ? 'Advance: ₹'+e.advanceAmount : 'Full'}</td>
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
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input type="number" required placeholder="Total Price" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" />
                  </div>
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
                  {formData.paymentType === 'ADVANCE' && (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                      <input type="number" required placeholder="Advance Amount to pay online" value={formData.advanceAmount || ''} onChange={(e) => setFormData({ ...formData, advanceAmount: Number(e.target.value) })} className="w-full p-3 pl-8 bg-slate-100 rounded-xl outline-none text-slate-800" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cover Image</label>
                  {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />}
                  <ImageUpload onUpload={(url) => setFormData({ ...formData, imageUrl: url as string })} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Gallery Images (Optional)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.gallery.map((img, i) => <img key={i} src={img} className="w-16 h-16 object-cover rounded-lg" />)}
                  </div>
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

// 2. OVERWRITE TOURDETAIL.TSX (With Gallery Display)
createFile('apps/web/src/pages/TourDetail.tsx', `
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WishlistButton from '../components/WishlistButton';
import FollowButton from '../components/FollowButton';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/tours/' + id)
      .then(res => res.json())
      .then(data => { setTour(data); setLoading(false); })
      .catch(() => { alert('Tour not found'); navigate('/'); });
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading tour...</div>;
  if (!tour) return null;

  const handleBookNow = () => {
    if (!localStorage.getItem('token')) return navigate('/login');
    navigate('/checkout', { state: { tour } });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition flex items-center gap-2">
          ← Back to Explore
        </button>
        <div className="absolute top-6 right-6">
          <WishlistButton itemId={tour.id} itemType="tour" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-600 px-3 py-1 rounded-full text-xs font-bold">Tour</span>
            <span className="text-sm font-medium bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">⭐ {tour.avgRating} ({tour.reviewCount} reviews)</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{tour.title}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <img src={tour.organizer.profileImageUrl || 'https://via.placeholder.com/60'} alt="" className="w-16 h-16 rounded-full object-cover" />
            <div className="flex-grow">
              <p className="text-sm text-slate-500">Operated by</p>
              <h3 className="text-xl font-bold text-slate-900">{tour.organizer.name}</h3>
              {tour.organizer.bio && <p className="text-sm text-slate-500 line-clamp-1">{tour.organizer.bio}</p>}
            </div>
            <FollowButton organizerId={tour.organizerId} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">About this experience</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{tour.description}</p>
          </div>

          {/* GALLERY SECTION */}
          {tour.gallery?.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Gallery</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {tour.gallery.map((img: string, i: number) => (
                  <img key={i} src={img} alt={\`Gallery \${i}\`} className="w-full h-40 object-cover rounded-xl shadow-sm" />
                ))}
              </div>
            </div>
          )}

          {tour.lat !== 0 && tour.lng !== 0 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Meeting Location</h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200 z-0">
                <MapContainer center={[tour.lat, tour.lng]} zoom={13} style={{ height: '300px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[tour.lat, tour.lng]} />
                </MapContainer>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Reviews ({tour.reviewCount})</h2>
            {tour.reviews.length === 0 ? (
              <p className="text-slate-500">No reviews yet. Be the first to review after your trip!</p>
            ) : (
              <div className="space-y-4">
                {tour.reviews.map((r: any) => (
                  <div key={r.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                      <img src={r.user.profileImageUrl || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-bold text-slate-900">{r.user.name}</p>
                        <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="ml-auto text-yellow-400 font-bold">{'★'.repeat(r.rating)}</div>
                    </div>
                    <p className="text-slate-600 text-sm">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-1">
          <motion.div 
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 sticky top-8"
          >
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-slate-900">₹{tour.price}</span>
              {tour.paymentType === 'ADVANCE' && <span className="text-sm text-slate-500">(Advance: ₹{tour.advanceAmount})</span>}
            </div>
            
            <div className="space-y-3 mb-6 text-sm border-t border-b border-slate-100 py-4">
              <div className="flex justify-between"><span className="text-slate-500">Payment Type</span><span className="font-medium text-slate-900">{tour.paymentType === 'ADVANCE' ? 'Advance Booking' : 'Full Payment'}</span></div>
              {tour.gstPercentage > 0 && <div className="flex justify-between"><span className="text-slate-500">GST ({tour.gstPercentage}%)</span><span className="font-medium text-slate-900">₹{(tour.price * tour.gstPercentage) / 100}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Platform Fee</span><span className="font-medium text-slate-900">Included</span></div>
            </div>

            <button onClick={handleBookNow} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition mb-3">
              {tour.paymentType === 'ADVANCE' ? 'Book with Advance' : 'Book Now'}
            </button>
            <p className="text-xs text-slate-400 text-center">You won't be charged yet. Free cancellation up to 7 days before.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
`);

console.log('\n✨ Step 49 (Gallery UI Auto-Inject) successfully generated!');
