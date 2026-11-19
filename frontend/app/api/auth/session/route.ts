import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getAccessToken,
  getServerUser,
} from "@/lib/auth/server-session";
import { getBackendBaseUrl } from "@/lib/api/backend-url";

const API_BASE_URL = getBackendBaseUrl();

export async function GET() {
  const token = await getAccessToken();
  const cachedUser = await getServerUser();

  if (!token || !cachedUser) {
    if (token || cachedUser) {
      await clearAuthCookies();
    }
    return NextResponse.json({
      success: true,
      data: { user: null },
    });
  }

  try {
    const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!meRes.ok) {
      await clearAuthCookies();
      return NextResponse.json({
        success: true,
        data: { user: null },
      });
    }

    const meJson = await meRes.json();
    return NextResponse.json({
      success: true,
      data: { user: meJson.data || cachedUser },
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: { user: cachedUser },
    });
  }
}
