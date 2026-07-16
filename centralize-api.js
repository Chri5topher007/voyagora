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

const configFilePath = path.join('apps', 'web', 'src', 'config.ts');
const configDir = path.dirname(configFilePath);
const files = walk('apps/web/src');
let updatedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('localhost:3000')) return; // Skip files that don't need changes

  // Replace all variations of the hardcoded URL
  content = content.split("(import.meta.env.VITE_API_URL || 'http://localhost:3000')").join("API_URL");
  content = content.split("'http://localhost:3000'").join("API_URL");
  content = content.split("http://localhost:3000").join("API_URL"); // Catch any remaining in template literals

  // Add the import statement if it's not already there
  if (!content.includes("import { API_URL }")) {
    const fileDir = path.dirname(file);
    let relativePath = path.relative(fileDir, configDir);
    if (relativePath === '') relativePath = '.';
    relativePath = relativePath.split(path.sep).join('/'); // Ensure forward slashes
    
    const importStatement = `import { API_URL } from '${relativePath}/config';\n`;
    
    // Insert import after the last import statement
    const importMatch = content.match(/^import.*$/gm);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      content = content.replace(lastImport, lastImport + '\n' + importStatement.trim());
    } else {
      content = importStatement + content;
    }
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ Centralized API in: ' + file);
  updatedFiles++;
});

console.log(`\n✨ Success! Centralized API_URL in ${updatedFiles} files.`);
