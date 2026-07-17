const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'uploads'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('apps/web/src');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Fix the broken string literal from previous step and add localhost fallback
  content = content.replace(/'import\.meta\.env\.VITE_API_URL/g, "(import.meta.env.VITE_API_URL || 'http://localhost:3000')");
  // Fix any remaining hardcoded localhost to also use the fallback
  content = content.replace(/'http:\/\/localhost:3000/g, "(import.meta.env.VITE_API_URL || 'http://localhost:3000')");
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Fixed API URL in: ' + file);
    changedFiles++;
  }
});

console.log(`\n✨ Success! Fixed API URLs in ${changedFiles} files.`);
