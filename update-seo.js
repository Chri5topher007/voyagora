const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Updated ' + filePath);
}

// 1. UPDATE INDEX.HTML (SEO Meta Tags & Mobile Web App)
createFile('apps/web/index.html', `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    
    <!-- Primary Meta Tags -->
    <title>Voyagora: Explore the Unexplored | Travel Packages, Events & Hidden Gems</title>
    <meta name="title" content="Voyagora: Explore the Unexplored" />
    <meta name="description" content="Your Ultimate Travel Operating System. Discover hidden gems, book local experiences, and build AI-crafted itineraries. Secure payments, instant QR tickets." />
    <meta name="keywords" content="travel, tours, events, hidden gems, voyagora, trekking, adventure, AI planner" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://voyagora.vercel.app/" />
    <meta property="og:title" content="Voyagora: Explore the Unexplored" />
    <meta property="og:description" content="Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here." />
    <meta property="og:image" content="https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1200&q=80" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="https://voyagora.vercel.app/" />
    <meta property="twitter:title" content="Voyagora: Explore the Unexplored" />
    <meta property="twitter:description" content="Discover hidden gems, book local experiences, and build AI-crafted itineraries. Your journey starts here." />
    <meta property="twitter:image" content="https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1200&q=80" />

    <!-- Mobile Web App / PWA -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Voyagora" />
    <meta name="theme-color" content="#0f172a" />
    
    <!-- Google Fonts: Serif for premium headings -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`);

// 2. UPDATE TAILWIND CONFIG (Add Premium Serif Font)
createFile('apps/web/tailwind.config.js', `
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
`);

// 3. ADD LAZY LOADING TO HOME PAGE IMAGES
let appContent = fs.readFileSync('apps/web/src/App.tsx', 'utf8');
appContent = appContent.split('<img src={tour.imageUrl}').join('<img loading="lazy" src={tour.imageUrl}');
appContent = appContent.split('<img src={event.imageUrl}').join('<img loading="lazy" src={event.imageUrl}');
appContent = appContent.split('<img src={gem.imageUrl}').join('<img loading="lazy" src={gem.imageUrl}');
appContent = appContent.split('<img src="https://images.unsplash.com/photo-1488646953014-85cb44e25828').join('<img loading="lazy" src="https://images.unsplash.com/photo-1488646953014-85cb44e25828');
appContent = appContent.split('<img src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30').join('<img loading="lazy" src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30');
appContent = appContent.split('<img src="https://images.unsplash.com/photo-1519046904884-53103b34b206').join('<img loading="lazy" src="https://images.unsplash.com/photo-1519046904884-53103b34b206');
fs.writeFileSync('apps/web/src/App.tsx', appContent);
console.log('✅ Added lazy loading to Home Page images.');

console.log('\n✨ SEO & Social Sharing Update Complete!');
