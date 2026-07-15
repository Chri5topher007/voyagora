const fs = require('fs');

let content = fs.readFileSync('apps/web/src/App.tsx', 'utf8');

// 1. Add the import
if (!content.includes("import EventDetail from './pages/EventDetail';")) {
  content = content.replace(
    "import GemDetail from './pages/GemDetail';",
    "import GemDetail from './pages/GemDetail';\nimport EventDetail from './pages/EventDetail';"
  );
}

// 2. Add the Route
if (!content.includes('<Route path="/events/:id" element={<EventDetail />} />')) {
  content = content.replace(
    '<Route path="/gems/:id" element={<GemDetail />} />',
    '<Route path="/gems/:id" element={<GemDetail />} />\n        <Route path="/events/:id" element={<EventDetail />} />'
  );
}

fs.writeFileSync('apps/web/src/App.tsx', content, 'utf8');
console.log('✅ EventDetail route automatically injected into App.tsx!');
