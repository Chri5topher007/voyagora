import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

export default function Scanner() {
  const navigate = useNavigate();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const verifyTicket = async (code: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/bookings/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ qrCode: code })
    });
    const data = await res.json();
    if (res.ok) setResult({ success: true, message: data.message });
    else setResult({ success: false, message: data.message || 'Invalid Ticket' });
  };

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'ORGANIZER' && role !== 'ADMIN') {
      navigate('/');
      return;
    }

    const startScanner = async () => {
      try {
        const html5Qrcode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5Qrcode;
        
        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            html5Qrcode.stop().catch(() => {});
            verifyTicket(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera error:", err);
        setCameraError(true); // Show manual input if camera fails
      }
    };
    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [navigate]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyTicket(manualCode);
  };

  const rescan = () => {
    setResult(null);
    setManualCode('');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <button onClick={() => navigate('/dashboard')} className="absolute top-8 left-8 text-slate-400 hover:text-white">← Dashboard</button>
      <h1 className="text-3xl font-bold text-white mb-8">Scan Ticket</h1>
      
      <div className="w-full max-w-md bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 p-6">
        {!result ? (
          <div>
            {/* Camera Scanner */}
            {!cameraError && <div id="qr-reader" className="w-full aspect-square rounded-xl overflow-hidden" />}
            
            {/* Manual Fallback (Shows if camera fails) */}
            {cameraError && (
              <div className="text-center text-slate-400 mb-6">
                <p className="mb-4">⚠️ Camera access is blocked or unavailable.</p>
                <p className="text-sm mb-4">Enter the ticket code manually:</p>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full p-3 bg-slate-700 text-white rounded-xl outline-none font-mono text-center"
                    placeholder="VOY-XXXX-XXXX-XXXX"
                    required
                  />
                  <button type="submit" className="w-full bg-indigo-600 py-3 rounded-xl font-bold hover:bg-indigo-500">
                    Verify Ticket
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className={`p-8 text-center flex flex-col items-center justify-center ${result.success ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 ${result.success ? 'bg-green-500' : 'bg-red-500'}`}>
              {result.success ? '✓' : '✕'}
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>{result.success ? 'Validated!' : 'Error'}</h2>
            <p className="text-slate-400 mb-6">{result.message}</p>
            <button onClick={rescan} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-semibold hover:bg-slate-200">Scan Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
