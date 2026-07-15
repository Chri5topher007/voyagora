
import { useState, useEffect } from 'react';

export default function WishlistButton({ itemId, itemType }: { itemId: string, itemType: string }) {
  const [saved, setSaved] = useState(false);
  const token = localStorage.getItem('token');

  // Check if already saved on mount
  useEffect(() => {
    if (!token) return;
    const checkStatus = async () => {
      const res = await fetch('http://localhost:3000/wishlist/mine', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const isSaved = data.some((w: any) => w[itemType]?.id === itemId);
      setSaved(isSaved);
    };
    checkStatus();
  }, [itemId, itemType, token]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!token) return alert('Please login to save items');
    
    const res = await fetch('http://localhost:3000/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
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
