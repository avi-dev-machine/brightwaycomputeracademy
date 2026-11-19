"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  CreditCard,
  IdCard,
  Phone,
  BookOpen,
  Calendar,
  Download,
  ArrowRight,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { StudentIdCardGenerator } from "@/components/id-card/student-id-card-generator";
import { RazorpayCheckoutButton } from "@/components/payments/razorpay-checkout";
import { CardSkeleton } from "@/components/ui/skeleton";

interface MonthlyLedgerItem {
  month_year: string;
  month_label: string;
  month_short: string;
  amount: number;
  amount_paise: number;
  status: "PAID" | "UNPAID" | "PENDING" | "FAILED";
  is_current_month: boolean;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  payment_date?: string | null;
}

interface FeePaymentRecord {
  id: string;
  student_id: string;
  amount: number;
  month_year: string;
  month_label?: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  status: string;
  payment_date?: string | null;
}

interface StudentProfileData {
  id: string;
  student_id: string;
  name: string;
  password?: string;
  initial_passcode: string;
  contact_number: string;
  course?: string;
  batch: string;
  monthly_fee: number;
  fee_status?: "PAID" | "UNPAID";
  current_month_status: "PAID" | "UNPAID";
  month?: string;
  current_month: string;
  month_label?: string;
  photo_url?: string | null;
  monthly_ledger: MonthlyLedgerItem[];
  fee_payments: FeePaymentRecord[];
}

export default function StudentDashboardPage() {
  const queryClient = useQueryClient();

  const { data: student, isLoading, error } = useQuery<StudentProfileData>({
    queryKey: ["student", "me"],
    queryFn: () => api.get<StudentProfileData>("/v1/student/me"),
  });

  const refreshProfile = () => {
    queryClient.invalidateQueries({ queryKey: ["student", "me"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load student profile. Please sign out and sign in again with your Student ID.
      </div>
    );
  }

  const activeStatus =
    student.fee_status || student.current_month_status || "UNPAID";
  const isCurrentPaid = activeStatus === "PAID";
  const activeMonth = student.month || student.current_month || "2027-12";
  const activeMonthLabel = student.month_label || "December 2027";
  const courseName = student.course || student.batch || "GENERAL";
  const passwordVal = student.password || student.initial_passcode;

  return (
    <div className="space-y-8">
      {/* Top Student Welcome Banner (#1E3A8A / #2563EB + Gold Accents) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1E3A8A] via-[#1E3A8A] to-[#2563EB] p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-[#FBBF24]/40 px-3 py-1 text-xs font-bold text-[#FBBF24]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Brightway Student Portal • {activeMonthLabel}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {student.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100 pt-1">
              <span className="inline-flex items-center gap-1.5 font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-[#FBBF24]">
                <IdCard className="h-3.5 w-3.5" />
                STUDENT ID: {student.student_id}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-[#FBBF24]" />
                COURSE: <strong>{courseName}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#FBBF24]" />
                CONTACT:{" "}
                <strong>
                  {student.contact_number &&
                  student.contact_number !== "0000000000"
                    ? student.contact_number
                    : "Not set"}
                </strong>
              </span>
            </div>
          </div>

          {/* Current Month Active Fee Status Callout */}
          <div className="rounded-2xl bg-white text-slate-900 p-5 shadow-xl min-w-[290px] border-2 border-[#FBBF24]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                MONTH: {activeMonthLabel}
              </span>
              {isCurrentPaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-extrabold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  PAID
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-3 py-0.5 text-xs font-extrabold">
                  <AlertCircle className="h-3.5 w-3.5 text-[#F59E0B]" />
                  UNPAID
                </span>
              )}
            </div>

            <p className="text-2xl font-extrabold text-[#1E3A8A] mb-3">
              ₹{Number(student.monthly_fee).toFixed(0)}{" "}
              <span className="text-xs font-medium text-slate-500">
                / {activeMonthLabel}
              </span>
            </p>

            {!isCurrentPaid ? (
              <RazorpayCheckoutButton
                monthYear={activeMonth}
                monthLabel={`${activeMonthLabel} (${activeMonth})`}
                monthlyFee={student.monthly_fee}
                studentId={student.student_id}
                studentName={student.name}
                contactNumber={student.contact_number}
                onSuccess={refreshProfile}
              />
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Your tuition fee for {activeMonthLabel} is PAID.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canonical Student Record Summary Table (NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES, MONTH) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#1E3A8A]">
              Your Official Student Record
            </h2>
            <p className="text-xs text-slate-500">
              Current active billing cycle: <strong>{activeMonthLabel}</strong>
            </p>
          </div>
          <Link
            href="/student/fees"
            className="text-xs font-extrabold text-[#2563EB] hover:text-[#1E3A8A] inline-flex items-center gap-1"
          >
            <span>Fee Ledger &amp; Receipts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1E3A8A] text-white uppercase">
              <tr>
                <th className="py-3 px-4 font-extrabold">NAME</th>
                <th className="py-3 px-4 font-extrabold">STUDENT ID</th>
                <th className="py-3 px-4 font-extrabold">PASSWORD</th>
                <th className="py-3 px-4 font-extrabold">CONTACT NO.</th>
                <th className="py-3 px-4 font-extrabold">COURSE</th>
                <th className="py-3 px-4 font-extrabold">FEES (PAID/UNPAID)</th>
                <th className="py-3 px-4 font-extrabold">MONTH</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="py-3.5 px-4 font-extrabold text-slate-900">
                  {student.name}
                </td>
                <td className="py-3.5 px-4 font-mono font-extrabold text-[#1E3A8A]">
                  {student.student_id}
                </td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center gap-1 font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                    <KeyRound className="h-3 w-3 text-[#2563EB]" />
                    {passwordVal}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-700">
                  {student.contact_number &&
                  student.contact_number !== "0000000000"
                    ? student.contact_number
                    : "—"}
                </td>
                <td className="py-3.5 px-4">
                  <span className="rounded-lg bg-blue-50 text-[#1E3A8A] px-2.5 py-1 font-extrabold">
                    {courseName}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  {isCurrentPaid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-extrabold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      PAID (₹{Number(student.monthly_fee).toFixed(0)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-3 py-1 font-extrabold">
                      <AlertCircle className="h-3.5 w-3.5 text-[#F59E0B]" />
                      UNPAID (₹{Number(student.monthly_fee).toFixed(0)})
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 font-extrabold text-[#1E3A8A]">
                  {activeMonthLabel}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2.2: Automated Digital ID Card Generator & Photo Upload */}
      <StudentIdCardGenerator
        studentId={student.student_id}
        name={student.name}
        batch={courseName}
        contactNumber={student.contact_number}
        monthlyFee={student.monthly_fee}
        photoUrl={student.photo_url}
        onPhotoUploaded={refreshProfile}
      />

      {/* Section 2.3: Active Month Fee Card & Payment History */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-[#2563EB] px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider">
              <CreditCard className="h-3.5 w-3.5" />
              Active Billing Cycle: {activeMonthLabel}
            </span>
            <h2 className="mt-1 font-display text-xl font-extrabold text-[#1E3A8A]">
              Monthly Tuition Fee Status &amp; Online Razorpay Payment
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(student.monthly_ledger || []).map((item) => {
            const isPaid = item.status === "PAID";
            return (
              <div
                key={item.month_year}
                className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                  item.is_current_month
                    ? "border-2 border-[#2563EB] bg-blue-50/30 shadow-xs"
                    : isPaid
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                      <Calendar className="h-3.5 w-3.5 text-[#1E3A8A]" />
                      {item.month_label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                        isPaid
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isPaid ? "PAID" : "UNPAID"}
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-extrabold text-[#1E3A8A]">
                    ₹{Number(item.amount).toFixed(0)}
                  </p>
                  {isPaid && item.razorpay_payment_id && (
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                      Ref: {item.razorpay_payment_id}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified Paid
                    </span>
                  ) : (
                    <RazorpayCheckoutButton
                      monthYear={item.month_year}
                      monthLabel={item.month_label}
                      monthlyFee={student.monthly_fee}
                      studentId={student.student_id}
                      studentName={student.name}
                      contactNumber={student.contact_number}
                      compact
                      onSuccess={refreshProfile}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recorded Payment Transactions Table */}
        {student.fee_payments && student.fee_payments.length > 0 && (
          <div className="pt-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
              Backend Archived Payment Transactions ({student.fee_payments.length})
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold">Fee Month</th>
                    <th className="py-3 px-4 font-bold">Amount</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Transaction Reference</th>
                    <th className="py-3 px-4 font-bold text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {student.fee_payments.map((fp) => (
                    <tr key={fp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {fp.month_label || fp.month_year}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-[#1E3A8A]">
                        ₹{Number(fp.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                            fp.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {fp.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {fp.razorpay_payment_id ||
                          fp.razorpay_order_id ||
                          "ADMIN-VERIFIED"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fp.status === "PAID" && (
                          <a
                            href={`/api/backend/v1/payments/${fp.id}/receipt.pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-[#1E3A8A]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
