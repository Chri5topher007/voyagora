
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalOrganizers: 0, totalTours: 0, totalEvents: 0, totalBookings: 0, platformRevenue: 0, grossVolume: 0, chartData: [] });

  const fetchPending = async () => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    const res = await fetch('import.meta.env.VITE_API_URL/community/pending', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 403) { navigate('/'); return; }
    const data = await res.json();
    setPlaces(data);
  };

  const fetchStats = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('import.meta.env.VITE_API_URL/admin/stats', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.ok) setStats(await res.json());
  };

  useEffect(() => { fetchPending(); fetchStats(); }, []);

  const approve = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch('import.meta.env.VITE_API_URL/community/' + id + '/approve', { method: 'PATCH', headers: { 'Authorization': 'Bearer ' + token } });
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
          <p className="text-slate-500">Platform-wide analytics and moderation.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Platform Revenue (Fees)</p>
            <h3 className="text-3xl font-bold text-green-600">₹{stats.platformRevenue.toLocaleString()}</h3>
            <p className="text-slate-400 text-xs mt-2">From 5% booking fees</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Gross Volume</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{stats.grossVolume.toLocaleString()}</h3>
            <p className="text-slate-400 text-xs mt-2">Total money processed</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-slate-500 text-sm mb-1">Total Users</p>
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalUsers}</h3>
            <p className="text-slate-400 text-xs mt-2">{stats.totalOrganizers} Organizers</p>
          </div>
        </div>

        {/* Platform Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-10">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Platform Revenue & Bookings (Last 7 Days)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="bookings" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
