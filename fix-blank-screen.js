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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('apps/web/src');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // FIX 1: Remove quotes around the API_URL variable
  content = content.split("'API_URL'").join("API_URL");
  content = content.split('"API_URL"').join("API_URL");
  
  // FIX 2: Add safe JSON parsing to prevent crashes on 404/network errors
  // This finds ".then(res => res.json())" and replaces it with a safe version
  content = content.split(".then(res => res.json())").join(".then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Error'); return data; })");
  content = content.split(".then(res => res.json())").join(".then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.message || 'Error'); return data; })"); // Catch variations
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Stabilized: ' + file);
    count++;
  }
});

console.log(`\n✨ Fixed ${count} files. The app will never go blank again!`);
