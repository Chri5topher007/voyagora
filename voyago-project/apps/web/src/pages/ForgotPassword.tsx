import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      // Always show the same generic confirmation, whether or not the
      // email exists — this matches the backend, which never reveals
      // whether an account exists for a given address.
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100"
      >
        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Voyagora<span className="text-indigo-600">.</span></h1>
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Reset your password</h2>

        {submitted ? (
          <div className="text-slate-600 text-sm">
            <p>If an account exists for <strong>{email}</strong>, we've sent a password reset link. It expires in 30 minutes.</p>
            <Link to="/login" className="inline-block mt-6 text-indigo-600 hover:text-indigo-800 font-semibold text-sm">← Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-slate-500 text-sm">Enter your email and we'll send you a link to reset your password.</p>
            <input
              type="email" required placeholder="Email Address" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 text-sm"
            />
            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition text-sm disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link to="/login" className="block text-center text-slate-500 text-sm hover:text-slate-800">← Back to login</Link>
          </form>
        )}
      </motion.div>
    </div>
  );
}
