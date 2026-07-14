const fs = require('fs');

function createFile(filePath, content) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed ' + filePath);
}

// 1. FORCE FIX BACKEND PACKAGE.JSON (Ensure cloudinary is installed)
createFile('apps/api/package.json', JSON.stringify({
  name: "api", version: "1.0.0", scripts: { 
    start: "node dist/main", 
    build: "tsc -p tsconfig.json",
    "db:migrate": "prisma db push --accept-data-loss && node dist/main.js"
  },
  dependencies: {
    "@nestjs/common": "^10.0.0", "@nestjs/core": "^10.0.0", "@nestjs/platform-express": "^10.0.0",
    "@nestjs/jwt": "^10.2.0", "@prisma/client": "^5.0.0", 
    "bcryptjs": "^2.4.3", "cloudinary": "^2.0.1", "multer": "^1.4.5-lts.1", "multer-storage-cloudinary": "^4.0.0",
    "nodemailer": "^6.9.13", "openai": "^4.28.0", "stripe": "^14.14.0", "path": "^0.12.7", "reflect-metadata": "^0.1.13", "rxjs": "^7.8.1"
  },
  devDependencies: { "@types/bcryptjs": "^2.4.6", "@types/multer": "^1.4.11", "@types/node": "^20.0.0", "@types/nodemailer": "^6.4.15", "prisma": "^5.0.0", "typescript": "^5.0.0" }
}, null, 2));

// 2. FIX IMAGE UPLOAD COMPONENT (Use 'any' to bypass TS strictness)
createFile('apps/web/src/components/ImageUpload.tsx', `
import { useState } from 'react';

export default function ImageUpload({ onUpload, multiple = false }: { onUpload: (data: any) => void, multiple?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: any) => {
    setLoading(true);
    const files = Array.from(e.target.files);
    const formData = new FormData();
    files.forEach((file: any) => formData.append('files', file));

    try {
      const res = await fetch('http://localhost:3000/uploads', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (multiple) {
        onUpload(data.urls);
      } else {
        onUpload(data.urls[0]);
      }
    } catch (err) {
      alert('Upload failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        multiple={multiple} 
        onChange={handleFile} 
        className="w-full p-3 bg-slate-100 rounded-xl outline-none text-slate-800 text-sm cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
      />
      {loading && <p className="text-slate-400 text-sm mt-2">Uploading to cloud...</p>}
    </div>
  );
}
`);

console.log('\n✨ Step 52 (Package & Type Fixes) successfully patched!');
