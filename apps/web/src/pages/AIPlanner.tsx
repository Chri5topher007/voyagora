
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
