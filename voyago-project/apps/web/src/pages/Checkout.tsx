
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authFetch, isLoggedIn } from '../lib/api';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const tour = location.state?.tour;
  const event = location.state?.event;
  const item = tour || event;
  const [loading, setLoading] = useState(false);
  const [travelDate, setTravelDate] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  
  // Payment Choice State: Default to FULL, or ADVANCE if the organizer only allows advance
  const [paymentChoice, setPaymentChoice] = useState(item?.paymentType === 'ADVANCE' ? 'ADVANCE' : 'FULL');

  if (!item) { navigate('/'); return null; }

  const allowsAdvance = item.paymentType === 'ADVANCE';
  const basePrice = item.price;
  const gst = (basePrice * (item.gstPercentage || 0)) / 100;
  
  // Calculate amount based on user's choice
  let amountPayableNow = paymentChoice === 'ADVANCE' ? (item.advanceAmount + gst) : (basePrice + gst);
  
  if (appliedDiscount > 0) {
    amountPayableNow = Math.max(0, amountPayableNow - appliedDiscount);
  }
  
  const pendingAmount = paymentChoice === 'ADVANCE' ? (basePrice + gst) - amountPayableNow - (item.advanceAmount || 0) : 0;

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoCode.toUpperCase() === 'VOYAGORA100') {
      setAppliedDiscount(100);
      alert('Promo code applied! ₹100 off');
    } else {
      setAppliedDiscount(0);
      alert('Invalid promo code.');
    }
  };

  const handlePay = async () => {
    if (tour && !travelDate) { alert('Please select a travel date'); return; }
    setLoading(true);
    if (!isLoggedIn()) return navigate('/login');

    const res = await authFetch(`/bookings/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        itemId: item.id, 
        itemType: tour ? 'tour' : 'event', 
        travelDate,
        couponCode: appliedDiscount > 0 ? promoCode.toUpperCase() : undefined,
        paymentChoice // Send the user's choice to the backend
      })
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; } 
    else { alert(data.message || 'Failed to initiate payment'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="bg-slate-900 p-6 text-white">
          <h2 className="text-2xl font-bold">Secure Checkout</h2>
          <p className="text-slate-400 text-sm">Powered by Stripe</p>
        </div>
        
        <div className="p-6">
          <div className="flex gap-4 mb-6">
            <img src={item.imageUrl} alt="" className="w-24 h-24 object-cover rounded-xl" />
            <div>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-2">{item.description}</p>
            </div>
          </div>

          {tour && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Travel Date</label>
              <input type="date" required value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="w-full p-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
            </div>
          )}

          {/* PAYMENT CHOICE UI */}
          {allowsAdvance && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Payment Option</label>
              <div className="flex gap-4">
                <button type="button" onClick={() => setPaymentChoice('FULL')} className={"flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition " + (paymentChoice === 'FULL' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-200 text-slate-600')}>
                  Pay Full<br/><span className="text-xs font-normal">₹{basePrice + gst}</span>
                </button>
                <button type="button" onClick={() => setPaymentChoice('ADVANCE')} className={"flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition " + (paymentChoice === 'ADVANCE' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-200 text-slate-600')}>
                  Pay Advance<br/><span className="text-xs font-normal">₹{item.advanceAmount + gst}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleApplyPromo} className="flex gap-2 mb-6">
            <input type="text" placeholder="Promo Code (VOYAGORA100)" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="flex-grow p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm uppercase" />
            <button type="submit" className="bg-slate-200 text-slate-800 px-4 rounded-xl text-sm font-semibold hover:bg-slate-300">Apply</button>
          </form>

          <div className="border-t border-slate-200 pt-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Base Price</span><span>₹{basePrice}</span></div>
            {item.gstPercentage > 0 && <div className="flex justify-between text-slate-500"><span>GST ({item.gstPercentage}%)</span><span>₹{gst}</span></div>}
            {appliedDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>- ₹{appliedDiscount}</span></div>}
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200 mt-2">
              <span>Payable Now</span><span>₹{amountPayableNow}</span>
            </div>
            {paymentChoice === 'ADVANCE' && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                ⚠️ <b>Pending Amount: ₹{basePrice + gst - amountPayableNow}</b><br/>This remaining amount must be paid directly to the organizer upon arrival.
              </div>
            )}
          </div>

          <button onClick={handlePay} disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Redirecting to Stripe...' : 'Pay ₹' + amountPayableNow + ' Now'}
          </button>
          <button onClick={() => navigate(-1)} className="w-full text-center text-slate-500 mt-4 text-sm hover:text-slate-900">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}
