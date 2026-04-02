/** Backend API origin: empty in dev (Vite proxy → localhost:8787). */
const PRODUCTION_API_BASE =
  "https://server-production-275b.up.railway.app";

const raw =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.PROD ? PRODUCTION_API_BASE : "");

export const API_BASE = raw.replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
