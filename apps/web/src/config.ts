
// Centralized API URL. 
// Uses Vercel env var in production, falls back to localhost for dev.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
