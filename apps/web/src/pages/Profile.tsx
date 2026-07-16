
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ImageUpload from '../components/ImageUpload';
import { API_URL } from '../config';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', bio: '', profileImageUrl: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    fetch(API_URL + '/users/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(res => res.json()).then(data => {
        setUser(data);
        setFormData({ name: data.name || '', bio: data.bio || '', profileImageUrl: data.profileImageUrl || '' });
      });
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    await fetch(API_URL + '/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(formData)
    });
    setLoading(false);
    alert('Profile updated!');
  };

  if (!user) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white p-6 hidden md:flex flex-col">
        <h1 className="text-2xl font-extrabold mb-10">Voyagora<span className="text-indigo-400">.</span></h1>
        <nav className="flex flex-col gap-4 flex-grow">
          <button onClick={() => navigate(user.role === 'ORGANIZER' ? '/dashboard' : '/traveler-dashboard')} className="text-left text-slate-400 hover:text-white flex items-center gap-2">← Back to Dashboard</button>
        </nav>
      </aside>

      <main className="flex-grow p-8 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-lg w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">My Profile</h2>
          
          <div className="flex items-center gap-4 mb-8">
            <img src={formData.profileImageUrl || 'https://via.placeholder.com/80'} alt="Avatar" className="w-20 h-20 rounded-full object-cover bg-slate-100" />
            <div>
              <p className="font-bold text-lg text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bio / Description</label>
              <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none h-24 text-slate-800" placeholder="Tell us about yourself..."></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Profile Picture</label>
              <ImageUpload onUpload={(url) => setFormData({ ...formData, profileImageUrl: url })} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
