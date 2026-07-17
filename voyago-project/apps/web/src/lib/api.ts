// Centralized API configuration.
// In production, set VITE_API_URL in your build environment (e.g. Vercel/Netlify
// project settings) to your deployed backend URL, e.g. https://api.voyagora.com
// In local development it falls back to the NestJS dev server on port 3000.
export const API_URL: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'voyagora_access_token';
const REFRESH_TOKEN_KEY = 'voyagora_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
export function isLoggedIn(): boolean {
  return !!getAccessToken();
}
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('role');
  localStorage.removeItem('subStatus');
}

// Small fetch wrapper so every call gets the right base URL without every
// component reinventing it.
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetch(url, options);
}

// Access tokens are short-lived (1h) by design (see DEPLOYMENT.md). This
// wrapper attaches the current one automatically, and if a request comes
// back 401 (expired), it silently exchanges the refresh token for a new
// access token once and retries — so users don't get logged out just
// because an hour passed while they were reading a page.
let refreshInFlight: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = apiFetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          clearTokens();
          return null;
        }
        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return data.accessToken as string;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = getAccessToken();
  const baseHeaders = (options.headers as Record<string, string>) || {};
  const withAuth = (token: string | null) => ({
    ...options,
    headers: { ...baseHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  let res = await apiFetch(path, withAuth(accessToken));
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await silentRefresh();
    if (newToken) {
      res = await apiFetch(path, withAuth(newToken));
    }
  }
  return res;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  clearTokens();
  if (refreshToken) {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort: tokens are already cleared client-side either way.
    }
  }
}
