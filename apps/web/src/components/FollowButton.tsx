import { useState, useEffect } from 'react';

export default function FollowButton({ organizerId }: { organizerId: string }) {
  const [following, setFollowing] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    // In a full app, you'd check if user is already following.
    // For MVP, we just render the button.
  }, [organizerId]);

  const handleClick = async () => {
    if (!token) return alert('Please login to follow organizers');
    const res = await fetch('import.meta.env.VITE_API_URL/follow/' + organizerId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
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
