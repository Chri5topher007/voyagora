
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../config';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch('API_URL/auth/verify-subscription?session_id=' + sessionId);
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('role', data.user.role);
          localStorage.setItem('subStatus', data.user.subscriptionStatus);
          setLoading(false);
        } else {
          setError(data.message || 'Verification failed');
          setLoading(false);
        }
      } catch (err) {
        setError('Network error during verification');
        setLoading(false);
      }
    };
    verify();
  }, [sessionId]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Verifying your subscription payment...</div>;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✕</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h1>
          <p className="text-slate-500 mb-8">{error}</p>
          <button onClick={() => navigate('/pricing')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">Back to Pricing</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Subscription Active!</h1>
        <p className="text-slate-500 mb-8">Your payment was successful. Your Organizer Dashboard is now unlocked.</p>
        <button onClick={() => navigate('/dashboard')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700">Go to Dashboard</button>
      </motion.div>
    </div>
  );
}
