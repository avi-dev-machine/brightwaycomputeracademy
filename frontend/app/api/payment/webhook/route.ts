import { NextResponse } from "next/server";
import { getBackendBaseUrl } from "@/lib/api/backend-url";

const API_BASE_URL = getBackendBaseUrl();

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("x-razorpay-signature") || "";
    const rawBody = await request.text();

    const upstream = await fetch(
      `${API_BASE_URL}/api/v1/payments/webhooks/razorpay`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Razorpay-Signature": signature,
        },
        body: rawBody,
      }
    );

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "WEBHOOK_FORWARD_ERROR",
          message: "Unable to forward Razorpay webhook.",
        },
      },
      { status: 502 }
    );
  }
}

