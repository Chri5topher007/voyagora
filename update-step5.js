const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. CREATE AI SERVICE (Mock OpenAI Logic)
createFile('apps/api/src/ai.service.ts', `
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
  async generateItinerary(prompt: string) {
    // MOCK AI: In production, this calls OpenAI API.
    // For MVP, we parse the prompt to simulate intelligence.
    const lowerPrompt = prompt.toLowerCase();
    let destination = 'India';
    if (lowerPrompt.includes('kerala')) destination = 'Kerala';
    else if (lowerPrompt.includes('maldives')) destination = 'Maldives';
    else if (lowerPrompt.includes('goa')) destination = 'Goa';
    
    // Extract budget if present
    const budgetMatch = prompt.match(/₹?(\d{1,3}(?:,\d{3})*|\d+)/);
    const budget = budgetMatch ? \`₹\${Number(budgetMatch[1].replace(/,/g, ''))}\` : '₹15,000';

    return {
      destination,
      estimatedBudget: budget,
      days: [
        { day: 1, morning: 'Arrival & Hotel Check-in', afternoon: 'Local Sightseeing Tour', evening: 'Befront Dinner', stay: 'Luxury Resort', food: 'Local Cuisine' },
        { day: 2, morning: 'Adventure Activity', afternoon: 'Photography Spot Visit', evening: 'Cultural Show', stay: 'Luxury Resort', food: 'Fine Dining' },
        { day: 3, morning: 'Leisure Walk', afternoon: 'Shopping for Souvenirs', evening: 'Departure', stay: 'N/A', food: 'Cafe' }
      ]
    };
  }
}
`);

// 2. CREATE AI CONTROLLER
createFile('apps/api/src/ai.controller.ts', `
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtService } from '@nestjs/jwt';

class JwtAuthGuard {
  constructor(private jwtService: JwtService) {}
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) return false;
    const token = authHeader.split(' ')[1];
    try { req.user = this.jwtService.verify(token); return true; } catch (e) { return false; }
  }
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(new JwtAuthGuard(new JwtService({ secret: 'super_secret_voyagora_key_123' })))
  @Post('itinerary')
  async generate(@Body() body: { prompt: string }) {
    return this.aiService.generateItinerary(body.prompt);
  }
}
`);

// 3. UPDATE APP MODULE
createFile('apps/api/src/app.module.ts', `
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AppController } from './app.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TourController } from './tour.controller';
import { TourService } from './tour.service';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({ global: true, secret: 'super_secret_voyagora_key_123', signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AppController, AuthController, TourController, BookingController, AiController],
  providers: [PrismaService, AuthService, TourService, BookingService, AiService],
})
export class AppModule {}
`);

// 4. CREATE AI PLANNER PAGE (Frontend)
createFile('apps/web/src/pages/AIPlanner.tsx', `
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AIPlanner() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('I have ₹25,000 for Kerala, love adventure and local food.');
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setItinerary(null);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    try {
      const res = await fetch('http://localhost:3000/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setItinerary(data);
    } catch (e) { alert('Failed to generate itinerary'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/')} className="mb-8 text-indigo-200 hover:text-white">← Back to Home</button>
        
        <h1 className="text-4xl font-extrabold mb-2">Voyagora AI Planner ✨</h1>
        <p className="text-indigo-200 mb-8">Tell us your budget and vibe. We'll build the perfect trip.</p>
        
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <input 
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            className="flex-grow p-4 rounded-xl text-gray-900 outline-none bg-white"
            placeholder="e.g., 3 days in Goa under ₹15,000"
          />
          <button onClick={generate} disabled={loading}
            className="bg-gray-900 text-white font-bold px-8 rounded-xl hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Thinking...' : 'Generate Itinerary'}
          </button>
        </div>

        {itinerary && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white text-gray-800 rounded-2xl shadow-2xl p-8">
            <div className="flex justify-between items-center border-b pb-4 mb-6">
              <h2 className="text-3xl font-bold">{itinerary.destination}</h2>
              <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold">
                Budget: {itinerary.estimatedBudget}
              </span>
            </div>
            
            <div className="space-y-6">
              {itinerary.days.map((day: any) => (
                <div key={day.day} className="border-l-4 border-indigo-500 pl-4">
                  <h3 className="text-xl font-bold mb-2">Day {day.day}</h3>
                  <ul className="space-y-1 text-gray-600">
                    <li>🌅 <b>Morning:</b> {day.morning}</li>
                    <li>☀️ <b>Afternoon:</b> {day.afternoon}</li>
                    <li>🌙 <b>Evening:</b> {day.evening}</li>
                    <li>🏨 <b>Stay:</b> {day.stay}</li>
                    <li>🍽️ <b>Food:</b> {day.food}</li>
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
`);

// 5. UPDATE APP.TSX (Add AI Route & Nav Button)
createFile('apps/web/src/App.tsx', `
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import AIPlanner from './pages/AIPlanner';

function Home() {
  const [destinations, setDestinations] = useState([]);
  const [tours, setTours] = useState([]);
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    fetch('http://localhost:3000/destinations').then(res => res.json()).then(data => setDestinations(data));
    fetch('http://localhost:3000/tours').then(res => res.json()).then(data => setTours(data));
  }, []);

  const handleBookNow = (tour: any) => {
    if (!isLoggedIn) navigate('/login');
    else navigate('/checkout', { state: { tour } });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Voyagora<span className="text-indigo-400">.</span></h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => navigate(isLoggedIn ? '/ai-planner' : '/login')} className="px-4 py-2 text-purple-400 hover:text-purple-300 transition font-semibold flex items-center gap-2">
            ✨ AI Planner
          </button>
          {isLoggedIn && <button onClick={() => navigate('/my-bookings')} className="px-4 py-2 text-gray-300 hover:text-white transition">My Bookings</button>}
          <button onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')} className="px-6 py-2 bg-indigo-600 rounded-full font-semibold hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/50">
            {isLoggedIn ? 'Dashboard' : 'Get Started'}
          </button>
        </div>
      </nav>

      <header className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center scale-105 blur-sm" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=80')" }} />
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div className="relative z-20 text-center px-4">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl md:text-7xl font-extrabold mb-4 tracking-tight">Explore the Unexplored</motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">Your Travel Operating System. Discover hidden gems, book local experiences, and build itineraries with AI.</motion.p>
          <div className="flex justify-center">
            <input type="text" placeholder="Where do you want to go?" className="px-6 py-4 w-full max-w-md rounded-l-xl text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            <button className="bg-indigo-600 px-8 rounded-r-xl font-bold hover:bg-indigo-500 transition">Search</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 py-16">
        <h3 className="text-3xl font-bold mb-8">Featured Tours by Organizers</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tours.map((tour: any, i) => (
            <motion.div key={tour.id} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl group cursor-pointer flex flex-col">
              <div className="h-48 overflow-hidden">
                <img src={tour.imageUrl} alt={tour.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-xs text-indigo-400 uppercase tracking-wider">{tour.organizer.name}</span>
                <h4 className="text-2xl font-bold mb-2 mt-1">{tour.title}</h4>
                <p className="text-gray-400 mb-4 line-clamp-2 flex-grow">{tour.description}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-2xl font-bold text-green-400">₹{tour.price}</span>
                  <button onClick={() => handleBookNow(tour)} className="bg-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-500 transition">Book Now</button>
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
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/ai-planner" element={<AIPlanner />} />
      </Routes>
    </Router>
  );
}
`);

console.log('\n✨ Step 5 (AI Itinerary Planner) successfully generated!');
