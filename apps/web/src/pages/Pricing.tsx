
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Pricing() {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: string) => {
    setLoadingTier(tier);
    const token = localStorage.getItem('token');
    if (!token) return navigate('/login');

    try {
      const res = await fetch('import.meta.env.VITE_API_URL/auth/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ tier })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to real Stripe Checkout
      } else {
        alert(data.message || 'Failed to initiate subscription payment');
        setLoadingTier(null);
      }
    } catch (err) {
      alert('Network error. Is the backend running?');
      setLoadingTier(null);
    }
  };

  const plans = [
    { id: 'STARTER', name: 'Starter', price: '₹999', features: ['Up to 5 Active Listings', 'Basic Analytics', 'Standard Support'] },
    { id: 'PROFESSIONAL', name: 'Professional', price: '₹2,999', features: ['Unlimited Listings', 'Advanced Heat Maps', 'Featured Listings (2/mo)', 'Priority Support'], popular: true },
    { id: 'ENTERPRISE', name: 'Enterprise', price: '₹9,999', features: ['Everything in Pro', 'API Access', 'Dedicated Account Manager', 'Custom Integrations'] }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Choose Your Plan</h1>
        <p className="text-slate-500">Unlock your organizer dashboard and start selling today. Secure payment via Stripe.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl w-full">
        {plans.map((plan, i) => (
          <motion.div 
            key={plan.id} 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={"bg-white p-8 rounded-2xl shadow-sm border flex flex-col " + (plan.popular ? 'border-indigo-600 ring-2 ring-indigo-600' : 'border-slate-200')}
          >
            {plan.popular && <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-semibold self-start mb-4">MOST POPULAR</span>}
            <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
            <p className="text-4xl font-extrabold mb-6">{plan.price}<span className="text-base font-normal text-slate-500">/mo</span></p>
            <ul className="space-y-3 mb-8 text-sm flex-grow">
              {plan.features.map(f => <li key={f} className="text-slate-600 flex items-center gap-2"><span className="text-green-500">✓</span> {f}</li>)}
            </ul>
            <button 
              onClick={() => handleSubscribe(plan.id)} 
              disabled={loadingTier !== null}
              className={"w-full py-3 rounded-xl font-bold text-sm transition mt-auto disabled:opacity-50 " + (plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')}
            >
              {loadingTier === plan.id ? 'Redirecting to Stripe...' : 'Subscribe & Pay'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
