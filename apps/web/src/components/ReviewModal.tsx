
import { useState } from 'react';
import { motion } from 'framer-motion';
import { API_URL } from '../config';

export default function ReviewModal({ itemId, itemType, itemName, onClose }: { itemId: string, itemType: string, itemName: string, onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    await fetch(API_URL + '/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ rating, comment, [itemType + 'Id']: itemId })
    });
    setLoading(false);
    onClose();
    alert('Review submitted! Thank you.');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Leave a Review</h2>
        <p className="text-slate-500 text-sm mb-6">{itemName}</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  type="button" key={star} onClick={() => setRating(star)}
                  className={"text-3xl transition-colors " + (star <= rating ? 'text-yellow-400' : 'text-slate-300 hover:text-yellow-200')}
                >★</button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Review</label>
            <textarea 
              required value={comment} onChange={(e) => setComment(e.target.value)} 
              className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 h-24" 
              placeholder="Share your experience..." 
            />
          </div>
          
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-300">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
