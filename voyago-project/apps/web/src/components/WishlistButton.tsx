
import { useState, useEffect } from 'react';
import { API_URL, authFetch, isLoggedIn } from '../lib/api';

export default function WishlistButton({ itemId, itemType }: { itemId: string, itemType: string }) {
  const [saved, setSaved] = useState(false);
  // Check if already saved on mount
  useEffect(() => {
    if (!isLoggedIn()) return;
    const checkStatus = async () => {
      const res = await authFetch(`/wishlist/mine`);
      const data = await res.json();
      const isSaved = data.some((w: any) => w[itemType]?.id === itemId);
      setSaved(isSaved);
    };
    checkStatus();
  }, [itemId, itemType]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!isLoggedIn()) return alert('Please login to save items');

    const res = await authFetch(`/wishlist/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, itemType })
    });
    const data = await res.json();
    setSaved(data.saved);
  };

  return (
    <button 
      onClick={handleClick} 
      className={"absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all " + (saved ? 'bg-red-500 text-white' : 'bg-white/90 backdrop-blur-md text-slate-700 hover:bg-white')}
    >
      {saved ? '❤️' : '🤍'}
    </button>
  );
}
