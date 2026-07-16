
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import WishlistButton from '../components/WishlistButton';
import FollowButton from '../components/FollowButton';
import { API_URL } from '../config';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_URL + '/events/' + id)
      .then(res => res.json())
      .then(data => { setEvent(data); setLoading(false); })
      .catch(() => { alert('Event not found'); navigate('/'); });
  }, [id, navigate]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading event...</div>;
  if (!event) return null;

  const handleBookNow = () => {
    if (!localStorage.getItem('token')) return navigate('/login');
    navigate('/checkout', { state: { event } });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        
        <button onClick={() => navigate('/explore/events')} className="absolute top-6 left-6 bg-white/80 backdrop-blur-md text-slate-800 px-4 py-2 rounded-full text-sm font-semibold hover:bg-white transition flex items-center gap-2">
          ← Back to Events
        </button>
        <div className="absolute top-6 right-6">
          <WishlistButton itemId={event.id} itemType="event" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-purple-600 px-3 py-1 rounded-full text-xs font-bold">Event</span>
            <span className="text-sm font-medium bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">⭐ {event.avgRating} ({event.reviewCount} reviews)</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-extrabold tracking-tight">{event.title}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <img src={event.organizer.profileImageUrl || 'https://via.placeholder.com/60'} alt="" className="w-16 h-16 rounded-full object-cover" />
            <div className="flex-grow">
              <p className="text-sm text-slate-500">Organized by</p>
              <h3 className="text-xl font-bold text-slate-900">{event.organizer.name}</h3>
              {event.organizer.bio && <p className="text-sm text-slate-500 line-clamp-1">{event.organizer.bio}</p>}
            </div>
            <FollowButton organizerId={event.organizerId} />
          </div>

          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">About this event</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{event.description}</p>
          </div>

          {event.lat !== 0 && event.lng !== 0 && (
            <div>
              <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">Event Location</h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200 z-0">
                <MapContainer center={[event.lat, event.lng]} zoom={13} style={{ height: '300px', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[event.lat, event.lng]} />
                </MapContainer>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-1">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 sticky top-8">
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-extrabold text-slate-900">₹{event.price}</span>
              {event.paymentType === 'ADVANCE' && <span className="text-sm text-slate-500">(Advance: ₹{event.advanceAmount})</span>}
            </div>
            
            <div className="space-y-3 mb-6 text-sm border-t border-b border-slate-100 py-4">
              <div className="flex justify-between"><span className="text-slate-500">Date & Time</span><span className="font-medium text-slate-900">{new Date(event.eventDate).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Type</span><span className="font-medium text-slate-900">{event.paymentType === 'ADVANCE' ? 'Advance Booking' : 'Full Payment'}</span></div>
              {event.gstPercentage > 0 && <div className="flex justify-between"><span className="text-slate-500">GST ({event.gstPercentage}%)</span><span className="font-medium text-slate-900">₹{(event.price * event.gstPercentage) / 100}</span></div>}
            </div>

            <button onClick={handleBookNow} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition mb-3">
              Book Now
            </button>
            <p className="text-xs text-slate-400 text-center">You won't be charged yet. Free cancellation up to 7 days before.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
