const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      // Ignore node_modules, .git, dist, uploads
      if (!['node_modules', '.git', 'dist', 'uploads'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      // Ignore images and lock files
      if (!file.match(/\.(png|jpg|jpeg|gif|ico|lock)$/i)) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk('.');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  // Replace all instances
  content = content.replace(/Voyagora/g, 'Voyagorara');
  content = content.replace(/voyagora/g, 'voyagorara');
  content = content.replace(/VOYAGORA/g, 'VOYAGORARA');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Renamed in: ' + file);
    changedFiles++;
  }
});

console.log(`\n✨ Success! Renamed Voyagora to Voyagorara in ${changedFiles} files.`);
