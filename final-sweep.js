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
  
  // Aggressively replace EVERY variation of localhost
  content = content.split("'http://localhost:3000'").join("API_URL");
  content = content.split('"http://localhost:3000"').join("API_URL");
  content = content.split("`http://localhost:3000`").join("API_URL");
  content = content.split("http://localhost:3000/").join("API_URL + '/"); // Handle template literals with paths
  content = content.split("http://localhost:3000").join("API_URL"); // Catch any remaining
  
  // Ensure config.ts is bulletproof
  if (file.includes('config.ts')) {
    content = `const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';\nexport const API_URL = isLocal ? 'http://localhost:3000' : 'https://voyagora.onrender.com';\n`;
  }
  
  // Ensure import exists if we changed something
  if (content !== original && !file.includes('config.ts')) {
    if (!content.includes("import { API_URL }")) {
      const fileDir = path.dirname(file);
      let relPath = path.relative(fileDir, path.join('apps', 'web', 'src'));
      if (relPath === '') relPath = '.';
      relPath = relPath.split(path.sep).join('/');
      content = `import { API_URL } from '${relPath}/config';\n` + content;
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('🔥 Fixed: ' + file);
    count++;
  } else if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('🔥 Fixed config.ts');
  }
});

console.log(`\n✅ Deep Sweep Complete. Fixed ${count} files.`);
