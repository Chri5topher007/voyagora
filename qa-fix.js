const fs = require('fs');
const path = require('path');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
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

// 3. SAFELY SWEEP ALL FILES FOR HARDCODED LOCALHOST AND FIX IMPORTS
const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'uploads'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
};

const files = walk('apps/web/src');
let fixedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Strictly replace the quoted hardcoded URL with API_URL
  content = content.split("'http://localhost:3000'").join("API_URL");
  
  // If we made a replacement, ensure the import exists
  if (content !== originalContent) {
    if (!content.includes("import { API_URL }")) {
      // Calculate relative path
      const fileDir = path.dirname(file);
      let relPath = path.relative(fileDir, path.join('apps', 'web', 'src'));
      if (relPath === '') relPath = '.';
      relPath = relPath.split(path.sep).join('/');
      
      const importStr = `import { API_URL } from '${relPath}/config';\n`;
      
      // Append to end of import block
      const imports = content.match(/^import .*$/gm);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        content = content.replace(lastImport, lastImport + '\n' + importStr.trim());
      } else {
        content = importStr + content;
      }
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('🔧 Replaced hardcoded URL in: ' + file);
    fixedCount++;
  }
});
console.log(`✅ Swept and fixed ${fixedCount} files.`);

console.log('\n✨ QA Audit Fixes Applied Successfully!');
