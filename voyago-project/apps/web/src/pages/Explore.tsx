
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../lib/api';

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
    let url = `${API_URL}/` + (type === 'gems' ? 'community' : type);
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
