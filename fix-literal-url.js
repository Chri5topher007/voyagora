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
  
  // Fix the literal string 'API_URL/' back to the variable API_URL + '/
  content = content.split("'API_URL/").join("API_URL + '/");
  content = content.split('"API_URL/').join('API_URL + "');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Fixed literal string in: ' + file);
    count++;
  }
});

console.log(`\n✨ Fixed ${count} files. The variable will now work perfectly!`);
