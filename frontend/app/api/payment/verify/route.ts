import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/server-session";
import { getBackendBaseUrl } from "@/lib/api/backend-url";

const API_BASE_URL = getBackendBaseUrl();

export async function POST(request: Request) {
  try {
    const token = await getAccessToken();
    const authHeader =
      request.headers.get("authorization") || (token ? `Bearer ${token}` : "");
    const body = await request.text();

    const upstream = await fetch(`${API_BASE_URL}/api/v1/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body,
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: "Unable to verify Razorpay payment signature.",
        },
      },
      { status: 502 }
    );
  }
}

