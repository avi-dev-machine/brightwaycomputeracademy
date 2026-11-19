"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Download,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api/client";
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
  contact_number: string;
  course?: string;
  batch: string;
  monthly_fee: number;
  fee_status?: "PAID" | "UNPAID";
  current_month_status: "PAID" | "UNPAID";
  month?: string;
  current_month: string;
  month_label?: string;
  monthly_ledger: MonthlyLedgerItem[];
  fee_payments: FeePaymentRecord[];
}

export default function StudentFeesPage() {
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery<StudentProfileData>({
    queryKey: ["student", "me"],
    queryFn: () => api.get<StudentProfileData>("/v1/student/me"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["student", "me"] });
  };

  if (isLoading || !student) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const activeStatus =
    student.fee_status || student.current_month_status || "UNPAID";
  const isCurrentPaid = activeStatus === "PAID";
  const activeMonth = student.month || student.current_month || "2027-12";
  const activeMonthLabel = student.month_label || "December 2027";
  const courseName = student.course || student.batch || "GENERAL";

  return (
    <div className="space-y-8">
      {/* Header & Current Month Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-[#2563EB] px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            Razorpay Secured Fee Portal • {activeMonthLabel}
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold text-[#1E3A8A]">
            Monthly Tuition Fee Ledger — {student.name} ({student.student_id})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Course: <strong>{courseName}</strong> • Monthly Tuition Fee:{" "}
            <strong>₹{Number(student.monthly_fee).toFixed(2)}</strong>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">
              Active Month ({activeMonthLabel})
            </p>
            <div className="mt-1 flex items-center gap-2">
              {isCurrentPaid ? (
                <span className="inline-flex items-center gap-1 text-sm font-extrabold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  PAID
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm font-extrabold text-amber-700">
                  <AlertCircle className="h-4 w-4 text-[#F59E0B]" />
                  UNPAID (₹{Number(student.monthly_fee).toFixed(0)} Due)
                </span>
              )}
            </div>
          </div>

          {!isCurrentPaid && (
            <RazorpayCheckoutButton
              monthYear={activeMonth}
              monthLabel={`${activeMonthLabel} (${activeMonth})`}
              monthlyFee={student.monthly_fee}
              studentId={student.student_id}
              studentName={student.name}
              contactNumber={student.contact_number}
              onSuccess={refresh}
            />
          )}
        </div>
      </div>

      {/* Active & Backend-Preserved Month Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="font-display text-lg font-extrabold text-[#1E3A8A] mb-4">
          Current &amp; Archived Monthly Fee Schedule
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(student.monthly_ledger || []).map((item) => {
            const isPaid = item.status === "PAID";
            return (
              <div
                key={item.month_year}
                className={`rounded-xl border p-4 flex flex-col justify-between ${
                  item.is_current_month
                    ? "border-2 border-[#2563EB] bg-blue-50/30"
                    : isPaid
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                      <Calendar className="h-4 w-4 text-[#1E3A8A]" />
                      {item.month_label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                        isPaid
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {isPaid ? "PAID" : "UNPAID"}
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-extrabold text-[#1E3A8A]">
                    ₹{Number(item.amount).toFixed(2)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Payment Settled
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
                      onSuccess={refresh}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="font-display text-lg font-extrabold text-[#1E3A8A] mb-4">
          Backend Archived Payment History &amp; Official Receipts
        </h2>
        {student.fee_payments && student.fee_payments.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold">Month</th>
                  <th className="py-3 px-4 font-bold">Amount</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Reference</th>
                  <th className="py-3 px-4 font-bold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.fee_payments.map((fp) => (
                  <tr key={fp.id} className="hover:bg-slate-50">
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
                          className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:text-[#1E3A8A]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download PDF</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No fee payment records found for {activeMonthLabel} yet.
          </p>
        )}
      </div>
    </div>
  );
}
