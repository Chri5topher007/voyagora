
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../config';

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');
    fetch(API_URL + '/bookings/mine', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => setBookings(data));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold">My Tickets</h1>
          <button onClick={() => navigate('/')} className="text-indigo-400 hover:text-indigo-300">← Back to Home</button>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-gray-800 p-8 rounded-2xl text-center text-gray-400">You haven't booked any tours yet.</div>
        ) : (
          <div className="space-y-6">
            {bookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col md:flex-row gap-6 items-center">
                
                {/* Ticket Details */}
                <div className="flex-grow">
                  <h3 className="text-2xl font-bold mb-1">{b.tour.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">Booked on: {new Date(b.createdAt).toLocaleDateString()}</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className={`px-3 py-1 rounded-full font-semibold ${b.isCheckedIn ? 'bg-gray-600 text-gray-300' : 'bg-green-100 text-green-700'}`}>
                      {b.isCheckedIn ? 'Used' : 'Valid'}
                    </span>
                    <span className="text-gray-300">Total Paid: <b>₹{b.totalAmount}</b></span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="bg-white p-3 rounded-xl flex flex-col items-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${b.qrCode}`} alt="QR Ticket" />
                  <p className="text-gray-800 text-xs font-mono mt-1 break-all">{b.qrCode}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
