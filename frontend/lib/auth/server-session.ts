import "server-only";
import { cookies } from "next/headers";
import type { MeOut, TokenOut } from "@/types/api";

export const ACCESS_TOKEN_COOKIE = "bw_access_token";
export const REFRESH_TOKEN_COOKIE = "bw_refresh_token";
export const USER_COOKIE = "bw_user";

const IS_PROD = process.env.NODE_ENV === "production";

export async function setAuthCookies(tokens: TokenOut, user: MeOut): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = tokens.expires_in || 86400;
  const refreshMaxAge = 60 * 60 * 24 * 30; // 30 days

  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  if (tokens.refresh_token) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
      path: "/",
      maxAge: refreshMaxAge,
    });
  }

  // Strictly httpOnly to prevent client-side cookie/role tampering
  cookieStore.set(USER_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: refreshMaxAge,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(USER_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getValidAccessToken(): Promise<string | undefined> {
  return getAccessToken();
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

export async function getSessionUser(): Promise<MeOut | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MeOut;
  } catch {
    return null;
  }
}

export async function getServerUser(): Promise<MeOut | null> {
  return getSessionUser();
}
