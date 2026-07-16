const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Created/Updated ' + filePath);
}

// 1. GUARANTEE VERCEL.JSON EXISTS (SPA Routing Fix)
createFile('apps/web/vercel.json', `
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
`);

// 2. CREATE 404 NOT FOUND PAGE
createFile('apps/web/src/pages/NotFound.tsx', `
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <h1 className="text-9xl font-extrabold text-indigo-600 mb-4">404</h1>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Page Not Found</h2>
        <p className="text-slate-500 mb-8 max-w-md">Oops! The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
        <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-md">
          Back to Homepage
        </button>
      </motion.div>
    </div>
  );
}
`);

// 3. AUTOMATICALLY INJECT 404 ROUTE AND FIX FOOTER IN APP.TSX
let appContent = fs.readFileSync('apps/web/src/App.tsx', 'utf8');

// Add 404 Import if missing
if (!appContent.includes("import NotFound from './pages/NotFound';")) {
  appContent = appContent.replace(
    "import EventDetail from './pages/EventDetail';",
    "import EventDetail from './pages/EventDetail';\nimport NotFound from './pages/NotFound';"
  );
}

// Add 404 Catch-All Route if missing
if (!appContent.includes('<Route path="*" element={<NotFound />} />')) {
  appContent = appContent.replace(
    '        <Route path="/admin" element={<AdminDashboard />} />\n      </Routes>',
    '        <Route path="/admin" element={<AdminDashboard />} />\n        <Route path="*" element={<NotFound />} />\n      </Routes>'
  );
}

// Replace the entire footer block with functional links using Regex
const newFooter = `<footer className="bg-slate-900 text-slate-400 py-16 font-sans">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          <div className="col-span-2 md:col-span-1">
            <h1 className="text-2xl font-serif font-bold text-white mb-4">Voyagora</h1>
            <p className="text-sm">Your Travel Operating System. Discover, book, and explore the world.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li onClick={() => navigate('/explore/tours')} className="hover:text-white cursor-pointer">Tours</li>
              <li onClick={() => navigate('/explore/events')} className="hover:text-white cursor-pointer">Events</li>
              <li onClick={() => navigate('/explore/gems')} className="hover:text-white cursor-pointer">Hidden Gems</li>
              <li onClick={() => navigate('/ai-planner')} className="hover:text-white cursor-pointer">AI Planner</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm">
              <li onClick={() => alert('About Us page coming soon!')} className="hover:text-white cursor-pointer">About Us</li>
              <li onClick={() => alert('Careers page coming soon!')} className="hover:text-white cursor-pointer">Careers</li>
              <li onClick={() => alert('Contact page coming soon!')} className="hover:text-white cursor-pointer">Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Newsletter</h4>
            <p className="text-sm mb-4">Get the best travel deals weekly.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email address" className="bg-slate-800 px-4 py-2 rounded-lg text-sm text-white outline-none flex-grow" />
              <button onClick={() => alert('Subscribed! (Mock)')} className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500">→</button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-12 pt-8 text-center text-sm">© 2024 Voyagora Ecosystem. Built for Travelers, by Travelers.</div>
      </footer>`;

// Use regex to find and replace everything between <footer> and </footer>
appContent = appContent.replace(/<footer[\s\S]*?<\/footer>/, newFooter);

fs.writeFileSync('apps/web/src/App.tsx', appContent);
console.log('✅ App.tsx 404 Route and Footer links automatically injected!');

console.log('\n✨ Automated QA Fixes Applied Successfully!');
