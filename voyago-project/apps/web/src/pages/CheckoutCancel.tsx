
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function CheckoutCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✕</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Cancelled</h1>
        <p className="text-slate-500 mb-8">Your payment was not processed. You can try again.</p>
        <button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">Back to Home</button>
      </motion.div>
    </div>
  );
}
