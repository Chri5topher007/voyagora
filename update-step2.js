const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE PRISMA SCHEMA (Add User Model)
createFile('apps/api/prisma/schema.prisma', `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Destination {
  id          String   @id @default(uuid())
  name        String
  description String
  createdAt   DateTime @default(now())
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("TRAVELER")
  createdAt DateTime @default(now())
}
`);

// 2. UPDATE API PACKAGE.JSON (Add Auth Dependencies)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { start: "node dist/main", build: "tsc -p tsconfig.json" },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", "bcryptjs": "^2.4.3", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/node": "^20.0.0", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 3. CREATE AUTH SERVICE (Register & Login Logic)
createFile('apps/api/src/auth.service.ts', `
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(dto: { email: string; password: string; name: string; role: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashedPassword, name: dto.name, role: dto.role }
    });

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}
`);

// 4. CREATE AUTH CONTROLLER
createFile('apps/api/src/auth.controller.ts', `
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; name: string; role: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body);
  }
}
`);

// 5. UPDATE APP MODULE (Wire up Auth & JWT)
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'super_secret_voyagora_key_123', // Hardcoded for MVP testing
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AppController, AuthController],
  providers: [PrismaService, AuthService],
})
export class AppModule {}
`);

// 6. UPDATE FRONTEND PACKAGE.JSON (Add React Router)
createFile('apps/web/package.json', JSON.stringify({
  name: "web", private: true, version: "0.0.0", type: "module",
  scripts: { build: "tsc && vite build" },
  dependencies: { "framer-motion": "^11.0.0", "react": "^18.2.0", "react-dom": "^18.2.0", "react-router-dom": "^6.22.0" },
  devDependencies: {
    "@types/react": "^18.2.0", "@types/react-dom": "^18.2.0", "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0", "postcss": "^8.4.0", "tailwindcss": "^3.4.0", "typescript": "^5.2.0", "vite": "^5.0.0"
  }
}, null, 2));

// 7. CREATE LOGIN PAGE UI
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
        else navigate('/');
      } else {
        alert(data.message || 'Something went wrong');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full"
      >
        <h2 className="text-3xl font-bold text-white mb-6 text-center">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {!isLogin && (
          <div className="flex gap-4 mb-6 bg-gray-900 p-2 rounded-xl">
            <button onClick={() => setRole('TRAVELER')} className={\`flex-1 py-2 rounded-lg font-semibold \${role === 'TRAVELER' ? 'bg-indigo-600 text-white' : 'text-gray-400'}\`}>Traveler</button>
            <button onClick={() => setRole('ORGANIZER')} className={\`flex-1 py-2 rounded-lg font-semibold \${role === 'ORGANIZER' ? 'bg-indigo-600 text-white' : 'text-gray-400'}\`}>Organizer</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input type="text" required placeholder="Full Name" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          )}
          <input type="email" required placeholder="Email Address" value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="password" required placeholder="Password" value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full p-3 bg-gray-700 text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
          
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500 transition">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center text-gray-400 mt-6 text-sm hover:text-white">
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </button>
      </motion.div>
    </div>
  );
}
`);

// 8. CREATE ORGANIZER DASHBOARD UI
createFile('apps/web/src/pages/Dashboard.tsx', `
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (!token || role !== 'ORGANIZER') {
      navigate('/login');
      return;
    }
    
    // In a real app, you'd fetch user details using the token here
    setUser({ name: 'Organizer', role: 'ORGANIZER' });
  }, [navigate]);

  const logout = () => {
    localStorage.clear();
    navigate('/');
  };

  if (!user) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">Organizer Dashboard</h1>
          <button onClick={logout} className="bg-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-500">Logout</button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Total Revenue</h3>
            <p className="text-4xl font-bold text-green-500">₹0</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }} className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Active Bookings</h3>
            <p className="text-4xl font-bold text-indigo-400">0</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
            <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Active Tours</h3>
            <p className="text-4xl font-bold text-purple-400">0</p>
          </motion.div>
        </div>

        <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700 flex flex-col items-center justify-center text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Voyagora!</h2>
          <p className="text-gray-400 mb-6 max-w-md">Your subscription is active. You can now start creating tour packages and accepting bookings.</p>
          <button className="bg-indigo-600 px-8 py-3 rounded-xl font-bold hover:bg-indigo-500 transition">
            + Create New Tour Package
          </button>
        </div>
      </div>
    </div>
  );
}
`);

// 9. UPDATE APP.TSX (Add Routing & Navbar Logic)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

const destinationImages: Record<string, string> = {
  "Maldives": "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=800&q=80",
  "Kerala": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80"
};

function Home() {
  const [destinations, setDestinations] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    fetch('http://localhost:3000/destinations')
      .then(res => res.json())
      .then(data => setDestinations(data))
      .catch(err => console.error(err));
  }, []);

  const handleAuthClick = () => {
    if (isLoggedIn) {
      if (role === 'ORGANIZER') navigate('/dashboard');
      else navigate('/dashboard'); // Or traveler dashboard later
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Voyagora<span className="text-indigo-400">.</span></h1>
        <button onClick={handleAuthClick} className="px-6 py-2 bg-indigo-600 rounded-full font-semibold hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/50">
          {isLoggedIn ? 'Dashboard' : 'Get Started'}
        </button>
      </nav>

      <header className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center scale-105 blur-sm" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div className="relative z-20 text-center px-4">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight">
            Explore the Unexplored
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Your Travel Operating System. Discover hidden gems, book local experiences, and build itineraries with AI.
          </motion.p>
          <div className="flex justify-center">
            <input type="text" placeholder="Where do you want to go?" className="px-6 py-4 w-full max-w-md rounded-l-xl text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            <button className="bg-indigo-600 px-8 rounded-r-xl font-bold hover:bg-indigo-500 transition">Search</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 py-16">
        <div className="flex justify-between items-end mb-8">
          <h3 className="text-3xl font-bold">Trending Destinations</h3>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {destinations.map((dest: any, i) => (
            <motion.div key={dest.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl group cursor-pointer">
              <div className="h-64 overflow-hidden">
                <img src={destinationImages[dest.name] || "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=800&q=80"} alt={dest.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <h4 className="text-2xl font-bold mb-2">{dest.name}</h4>
                <p className="text-gray-400 mb-4">{dest.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">⭐ 4.8 (240 reviews)</span>
                  <button className="text-indigo-400 font-semibold hover:text-indigo-300">Explore →</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
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
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 2 (Auth & Dashboard) successfully generated!');
