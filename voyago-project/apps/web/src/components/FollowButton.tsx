import { useState, useEffect } from 'react';
import { API_URL, authFetch, isLoggedIn } from '../lib/api';

export default function FollowButton({ organizerId }: { organizerId: string }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    // In a full app, you'd check if user is already following.
    // For MVP, we just render the button.
  }, [organizerId]);

  const handleClick = async () => {
    if (!isLoggedIn()) return alert('Please login to follow organizers');
    const res = await authFetch(`/follow/` + organizerId, { method: 'POST' });
    const data = await res.json();
    setFollowing(data.following);
  };

  return (
    <button 
      onClick={handleClick} 
      className={"px-4 py-2 rounded-xl text-sm font-bold transition " + (following ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-indigo-600 text-white hover:bg-indigo-700')}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  );
}
