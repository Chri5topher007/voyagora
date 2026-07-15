const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// REWRITE LOGIN.TSX WITH CLEAN API URL
createFile('apps/web/src/pages/Login.tsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('TRAVELER');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? 'login' : 'register';
    const payload = isLogin ? { email: formData.email, password: formData.password } : { ...formData, role };

    try {
      const res = await fetch('http://localhost:3000/auth/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        localStorage.setItem('subStatus', data.user.subscriptionStatus);
        
        if (data.user.role === 'ADMIN') navigate('/admin');
        else if (data.user.role === 'ORGANIZER') {
          if (data.user.subscriptionStatus === 'ACTIVE') navigate('/dashboard');
          else navigate('/pricing');
        }
        else navigate('/traveler-dashboard');
      } else {
        alert(data.message || 'Something went wrong');
      }
    } catch (err) {
      alert('Network Error: Backend is not running. Check terminal logs!');
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden md:flex w-1/2 bg-cover bg-center relative" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1000&q=80')" }}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-extrabold mb-4">Explore the Unexplored.</h2>
          <p className="text-lg text-gray-200">Join the ultimate travel ecosystem. Discover, book, and manage your journeys.</p>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100"
        >
          <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Voyagora<span className="text-indigo-600">.</span></h1>
          <h2 className="text-2xl font-bold text-slate-800 mb-6">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>

          {!isLogin && (
            <div className="flex gap-4 mb-6 bg-slate-100 p-2 rounded-xl">
              <button onClick={() => setRole('TRAVELER')} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (role === 'TRAVELER' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Traveler</button>
              <button onClick={() => setRole('ORGANIZER')} className={"flex-1 py-2 rounded-lg font-semibold text-sm " + (role === 'ORGANIZER' ? 'bg-indigo-600 text-white' : 'text-slate-600')}>Organizer</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <input type="text" required placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm" />
            )}
            <input type="email" required placeholder="Email Address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm" />
            <input type="password" required placeholder="Password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm" />
            
            <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition text-sm">
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
          </form>

          <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-slate-500 mt-6 text-sm hover:text-slate-800">
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
`);

console.log('\n✨ Login Page Fixed Successfully!');
