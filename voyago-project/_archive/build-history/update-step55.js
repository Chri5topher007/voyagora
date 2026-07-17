const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE BOOKING SERVICE (Dynamic Stripe Redirects)
let bookingService = fs.readFileSync('apps/api/src/booking.service.ts', 'utf8');
bookingService = bookingService.replace(/http:\/\/localhost:8080/g, "process.env.FRONTEND_URL");
fs.writeFileSync('apps/api/src/booking.service.ts', bookingService);
console.log('✅ Fixed Booking Service Redirects');

// 2. UPDATE AUTH SERVICE (Dynamic Stripe Redirects)
let authService = fs.readFileSync('apps/api/src/auth.service.ts', 'utf8');
authService = authService.replace(/http:\/\/localhost:8080/g, "process.env.FRONTEND_URL");
fs.writeFileSync('apps/api/src/auth.service.ts', authService);
console.log('✅ Fixed Auth Service Redirects');

// 3. UPDATE FRONTEND API CALLS (Dynamic Backend URL)
const walk = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = require('path').join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Replace hardcode with Vite environment variable
      const newContent = content.replace(/http:\/\/localhost:3000/g, "import.meta.env.VITE_API_URL");
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log('✅ Fixed API URL in ' + fullPath);
      }
    }
  }
};
walk('apps/web/src');

// 4. CREATE .gitignore
createFile('.gitignore', `node_modules\n.env\ndist\nuploads`);

console.log('\n✨ Step 55 (Production Prep) complete! You are ready to deploy.');
