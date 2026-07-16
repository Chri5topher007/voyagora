
// Vite automatically sets import.meta.env.PROD to true when building for Vercel.
// This completely bypasses the need for Vercel Environment Variables.
const isProd = import.meta.env.PROD;

// In production (Vercel), use the live Render URL. Locally, use localhost.
export const API_URL = isProd 
  ? 'https://voyagora.onrender.com' 
  : 'http://localhost:3000';
