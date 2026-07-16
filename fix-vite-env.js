const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// CREATE VITE ENV TYPE DEFINITION
createFile('apps/web/src/vite-env.d.ts', `
/// <reference types="vite/client" />
`);

console.log('\n✨ Vite Env Types Fixed!');
