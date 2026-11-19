"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (
        event: string,
        callback: (response: { error?: { description?: string } }) => void
      ) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.getElementById("razorpay-checkout-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface RazorpayCheckoutButtonProps {
  monthYear: string;
  monthLabel?: string;
  monthlyFee: number;
  studentId?: string;
  studentName?: string;
  contactNumber?: string;
  compact?: boolean;
  onSuccess?: () => void;
}

export function RazorpayCheckoutButton({
  monthYear,
  monthLabel,
  monthlyFee,
  studentId,
  studentName,
  contactNumber,
  compact = false,
  onSuccess,
}: RazorpayCheckoutButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handlePayNow = async () => {
    setIsProcessing(true);
    try {
      // 1. Initialize Razorpay Order server-side via /api/payment/create-order
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month_year: monthYear,
          ...(studentId ? { student_id: studentId } : {}),
        }),
      });

      const orderJson = await orderRes.json();
      if (!orderRes.ok || !orderJson.success) {
        throw new Error(
          orderJson?.error?.message || "Failed to initialize Razorpay order."
        );
      }

      const orderData = orderJson.data;

      // 2. Load Razorpay Checkout SDK
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        throw new Error(
          "Could not load Razorpay Checkout SDK. Please check your internet connection."
        );
      }

      // 3. Open Razorpay Modal for UPI / Card / NetBanking
      const rzp = new window.Razorpay({
        key: orderData.key_id,
        amount: orderData.amount_paise,
        currency: orderData.currency || "INR",
        name: "Brightway Computer Academy",
        description:
          orderData.fee_description ||
          `Monthly Fee - ${monthLabel || monthYear}`,
        order_id: orderData.order_id,
        prefill: {
          name: orderData.student_name || studentName || "",
          contact:
            (orderData.student_phone || contactNumber) !== "0000000000"
              ? orderData.student_phone || contactNumber
              : "",
        },
        notes: {
          student_id: orderData.student_id || studentId || "",
          month_year: monthYear,
        },
        theme: {
          color: "#1E3A8A",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
          },
        },
        handler: async (response: RazorpaySuccessResponse) => {
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyJson = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success) {
              throw new Error(
                verifyJson?.error?.message ||
                  "Payment signature verification failed."
              );
            }
            toast({
              type: "success",
              title: "Fee Payment Verified!",
              description: `₹${monthlyFee.toFixed(0)} for ${
                monthLabel || monthYear
              } has been recorded as PAID.`,
            });
            setIsProcessing(false);
            onSuccess?.();
          } catch (err) {
            setIsProcessing(false);
            toast({
              type: "error",
              title: "Verification Error",
              description:
                err instanceof Error
                  ? err.message
                  : "Could not verify payment signature.",
            });
          }
        },
      });

      rzp.on("payment.failed", (resp) => {
        setIsProcessing(false);
        toast({
          type: "error",
          title: "Payment Failed",
          description:
            resp.error?.description ||
            "Your transaction was declined. Please try again.",
        });
      });

      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      toast({
        type: "error",
        title: "Unable to Start Checkout",
        description:
          err instanceof Error ? err.message : "Could not create payment order.",
      });
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handlePayNow}
        disabled={isProcessing}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-xs transition-colors cursor-pointer"
      >
        {isProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FBBF24]" />
        ) : (
          <CreditCard className="h-3.5 w-3.5 text-[#FBBF24]" />
        )}
        <span>{isProcessing ? "Opening..." : `Pay ₹${monthlyFee}`}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handlePayNow}
        disabled={isProcessing}
        className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 px-6 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#FBBF24]" />
        ) : (
          <CreditCard className="h-4 w-4 text-[#FBBF24]" />
        )}
        <span>
          {isProcessing
            ? "Initializing Razorpay..."
            : `Pay ₹${monthlyFee.toFixed(0)} via Razorpay (${
                monthLabel || monthYear
              })`}
        </span>
      </button>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>
          256-bit HMAC-SHA256 Verified • UPI, Cards &amp; NetBanking supported
        </span>
      </div>
    </div>
  );
}
