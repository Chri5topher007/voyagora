const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Replace process.env.FRONTEND_URL with a safe fallback to localhost
  content = content.split("process.env.FRONTEND_URL + '").join("(process.env.FRONTEND_URL || 'http://localhost:8080') + '");
  content = content.split('process.env.FRONTEND_URL + "').join('(process.env.FRONTEND_URL || "http://localhost:8080") + "');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed Stripe URLs in ' + filePath);
}

fixFile('apps/api/src/booking.service.ts');
fixFile('apps/api/src/auth.service.ts');

console.log('\n✨ Stripe URL Fix Complete!');
