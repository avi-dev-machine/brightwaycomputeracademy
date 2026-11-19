/**
 * Resolves and normalizes the upstream FastAPI backend base URL (e.g. Render service URL).
 * Accepts either `API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` in Vercel environment variables
 * and strips any accidental trailing `/` or `/api/v1` suffix.
 */
export function getBackendBaseUrl(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000";
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/, "")
    .replace(/\/api$/, "");
}
