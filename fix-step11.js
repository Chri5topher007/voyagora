const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FIX DOCKER-COMPOSE.YML (Add Database Healthcheck & Wait logic)
createFile('docker-compose.yml', `
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: voyagora
      POSTGRES_PASSWORD: voyagora123
      POSTGRES_DB: voyagora
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U voyagora"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./apps/api
    ports: ["3000:3000"]
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql://voyagora:voyagora123@postgres:5432/voyagora?schema=public
      - JWT_SECRET=super_secret_voyagora_key_123
      - FRONTEND_URL=http://localhost:8080
    depends_on:
      postgres:
        condition: service_healthy
    # Wait for DB to be healthy, then push schema and start
    command: sh -c "npx prisma db push && node dist/main.js"

  web:
    build: ./apps/web
    ports: ["8080:80"]
    depends_on:
      - api

volumes:
  pgdata:
`);

// 2. UPDATE LOGIN.TSX (Show actual error instead of generic Network Error)
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
        if (data.user.role === 'ORGANIZER') navigate('/dashboard');
        else if (data.user.role === 'ADMIN') navigate('/admin');
        else navigate('/traveler-dashboard');
      } else {
        alert(data.message || 'Something went wrong');
      }
    } catch (err: any) {
      alert('Network Error: Backend is not running. Check terminal logs!');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100"
      >
        <h2 className="text-3xl font-bold text-slate-800 mb-6 text-center">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {!isLogin && (
          <div className="flex gap-4 mb-6 bg-slate-100 p-2 rounded-xl">
            <button onClick={() => setRole('TRAVELER')} className={\`flex-1 py-2 rounded-lg font-semibold \${role === 'TRAVELER' ? 'bg-indigo-600 text-white' : 'text-slate-600'}\`}>Traveler</button>
            <button onClick={() => setRole('ORGANIZER')} className={\`flex-1 py-2 rounded-lg font-semibold \${role === 'ORGANIZER' ? 'bg-indigo-600 text-white' : 'text-slate-600'}\`}>Organizer</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input type="text" required placeholder="Full Name" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
          )}
          <input type="email" required placeholder="Email Address" value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
          <input type="password" required placeholder="Password" value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
          
          <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-slate-500 mt-6 text-sm hover:text-slate-800">
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </button>
      </motion.div>
    </div>
  );
}
`);

console.log('\n✨ Step 11 (Docker Healthcheck Fix) successfully generated!');
