/**
 * Resolves and normalizes the upstream FastAPI backend base URL (Render service URL in production).
 * Accepts either `API_BASE_URL` or `NEXT_PUBLIC_API_BASE_URL` in Vercel environment variables
 * and defaults to `https://brightwaycomputeracademy.onrender.com` in production.
 */
export function getBackendBaseUrl(): string {
  const defaultUrl =
    process.env.NODE_ENV === "production"
      ? "https://brightwaycomputeracademy.onrender.com"
      : "http://localhost:8000";

  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    defaultUrl;

  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/, "")
    .replace(/\/api$/, "");
}
