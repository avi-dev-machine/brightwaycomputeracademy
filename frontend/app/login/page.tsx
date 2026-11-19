"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  Lock,
  IdCard,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api/client";

function LoginForm() {
  const [mode, setMode] = useState<"student" | "admin">("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const studentIdParam = searchParams.get("student_id");
    const redirectParam = searchParams.get("redirect");

    if (modeParam === "admin" || (redirectParam && redirectParam.startsWith("/admin"))) {
      setMode("admin");
    } else if (studentIdParam) {
      setMode("student");
      setIdentifier(studentIdParam.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = identifier.trim();
    const cleanSecret = password.trim();

    if (!cleanId || !cleanSecret) {
      setError(
        mode === "student"
          ? "Please enter both your Student ID and Passcode / Contact Number."
          : "Please enter both Admin Username and Password."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login({ identifier: cleanId, password: cleanSecret });
      const redirectParam = searchParams.get("redirect");
      const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

      if (redirectParam && redirectParam.startsWith("/")) {
        if (redirectParam.startsWith("/admin") && isAdmin) {
          router.push(redirectParam);
          return;
        }
        if (redirectParam.startsWith("/student") && user.role === "STUDENT") {
          router.push(redirectParam);
          return;
        }
      }

      if (isAdmin) {
        router.push("/admin");
      } else {
        router.push("/student");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Invalid credentials. Please verify your ID and password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => {
            setMode("student");
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-extrabold transition-all ${
            mode === "student"
              ? "bg-[#1E3A8A] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GraduationCap className="h-4 w-4 text-[#FBBF24]" />
          <span>Student Login</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("admin");
            setError(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-extrabold transition-all ${
            mode === "admin"
              ? "bg-[#1E3A8A] text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-[#FBBF24]" />
          <span>Admin Portal</span>
        </button>
      </div>

      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#1E3A8A]">
          {mode === "student" ? "Student Portal Sign In" : "Administrator Sign In"}
        </h1>
        <p className="mt-1.5 text-xs text-slate-600">
          {mode === "student"
            ? "Sign in with your unique Student ID and Passcode (or registered Contact Number)."
            : "Restricted to authorized Brightway Super Administrators."}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-medium">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            {mode === "student" ? "Student ID" : "Admin Username"}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <IdCard className="h-4 w-4" />
            </div>
            <input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                mode === "student"
                  ? "e.g. RG240017 or BW240038"
                  : "e.g. BWADMIN"
              }
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            {mode === "student"
              ? "Passcode or Contact Number"
              : "Administrator Password"}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "student"
                  ? "e.g. AGN0017 or 10-digit mobile number"
                  : "Enter administrator password"
              }
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 px-5 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
        >
          <KeyRound className="h-4 w-4 text-[#FBBF24]" />
          <span>
            {isSubmitting
              ? "Verifying Credentials..."
              : mode === "student"
              ? "Sign In to Student Dashboard"
              : "Sign In to Admin Portal"}
          </span>
        </button>
      </form>

      {/* Credential Format Guide */}
      {mode === "student" ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-slate-700 space-y-2">
          <p className="font-bold text-[#1E3A8A]">Student Login Format:</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-600">
            <li>
              <span className="font-semibold text-slate-800">Student ID:</span> Your registration code from your batch sheet (e.g.{" "}
              <code className="font-mono font-bold text-[#1E3A8A]">RG240017</code>).
            </li>
            <li>
              <span className="font-semibold text-slate-800">Passcode:</span> First 3 letters of your Name (UPPERCASE) + Last 4 digits of your Student ID (e.g.{" "}
              <code className="font-mono font-bold text-[#1E3A8A]">AGN0017</code>),{" "}
              <span className="italic">or</span> your registered 10-digit Contact Number.
            </li>
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-slate-700">
          <p className="font-bold text-slate-900">Authorized Super Admin Access</p>
          <p className="text-slate-600 mt-1">
            Protected by bcrypt password hashing and server-side JWT verification.
          </p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-white">
      {/* Left Brand Column (#1E3A8A Deep Trust Blue + #F59E0B Gold Accents) */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-[#1E3A8A] via-[#1E3A8A] to-[#2563EB] p-12 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FBBF24_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#FBBF24] ring-2 ring-[#FBBF24]/40">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="font-display text-lg font-extrabold tracking-tight text-white block leading-none">
                BRIGHTWAY
              </span>
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#FBBF24]">
                Computer Education
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <span className="inline-block rounded-full bg-[#F59E0B] text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider">
            Affiliated to RGYCSM (rgycsm.org)
          </span>
          <h2 className="font-display text-4xl font-extrabold tracking-tight leading-tight">
            BRIGHTWAY COMPUTER EDUCATION — Digital Student &amp; Fee Portal.
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed">
            Log in with your Student ID and Password to view your monthly tuition fee status, pay securely via Razorpay, upload your photograph, and download your official Brightway Student ID Card.
          </p>
        </div>

        <div className="relative z-10 text-xs text-blue-200 flex items-center justify-between">
          <span>&copy; 2027 BRIGHTWAY COMPUTER EDUCATION</span>
          <span>RGYCSM Affiliated • ISO 9001:2015</span>
        </div>
      </div>

      {/* Right Login Form Column */}
      <div className="flex flex-1 flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#1E3A8A] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Brightway Home
          </Link>
        </div>

        <Suspense fallback={<div className="text-sm text-slate-500">Loading login portal...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
