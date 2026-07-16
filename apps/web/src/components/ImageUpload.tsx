
import { useState } from 'react';
import { API_URL } from '../config';

export default function ImageUpload({ onUpload, multiple = false }: { onUpload: (data: any) => void, multiple?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: any) => {
    setLoading(true);
    const files = Array.from(e.target.files);
    const formData = new FormData();
    files.forEach((file: any) => formData.append('files', file));

    try {
      const res = await fetch(API_URL + '/uploads', { method: 'POST', body: formData });
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
