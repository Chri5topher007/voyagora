
// This completely bypasses Vercel Environment Variables.
// If you are on localhost, it uses localhost. If you are on Vercel, it uses Render.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_URL = isLocal 
  ? 'http://localhost:3000' 
  : 'https://voyagora.onrender.com';
