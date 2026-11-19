"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  Search,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  IndianRupee,
  Save,
  X,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";

interface MonthCell {
  id: string | null;
  status: "PAID" | "UNPAID" | "PENDING" | "FAILED";
  amount: number;
  payment_mode?: string | null;
  received_by?: string | null;
  razorpay_payment_id?: string | null;
  payment_date?: string | null;
}

interface MatrixStudentRow {
  id: string;
  name: string;
  student_id: string;
  course: string;
  batch: string;
  monthly_fee: number;
  fee_status: "PAID" | "UNPAID";
  month: string;
  month_label: string;
  active: boolean;
  status: "ACTIVE" | "INACTIVE";
  active_month: string;
  active_month_status: "PAID" | "UNPAID";
  active_payment_date?: string | null;
  active_payment_mode?: string | null;
  active_received_by?: string | null;
  months: Record<string, MonthCell>;
  total_paid: number;
  unpaid_months_count: number;
}

interface FeeLedgerMatrixResponse {
  year: number;
  active_month: string;
  active_month_label: string;
  months_header: string[];
  month_labels?: Record<string, string>;
  items: MatrixStudentRow[];
  total: number;
  page: number;
  page_size: number;
}

interface DailyCollectionReport {
  date: string;
  total_transactions: number;
  total_collected: number;
  cash_collected: number;
  online_collected: number;
  items: Array<{
    id: string;
    student_name: string;
    student_id: string;
    course: string;
    month_label: string;
    amount: number;
    payment_mode: string;
    received_by: string;
    transaction_id: string;
    payment_date: string;
  }>;
}

interface PaymentCorrectionItem {
  id: string;
  student_name: string;
  student_id: string;
  month_year: string;
  month_label: string;
  previous_status: string;
  new_status: string;
  previous_amount: number;
  new_amount: number;
  payment_mode: string;
  received_by: string;
  remarks: string;
  updated_by: string;
  updated_by_role: string;
  created_at: string;
}

const MONTHS_LIST = [
  { num: "01", short: "Jan", name: "January" },
  { num: "02", short: "Feb", name: "February" },
  { num: "03", short: "Mar", name: "March" },
  { num: "04", short: "Apr", name: "April" },
  { num: "05", short: "May", name: "May" },
  { num: "06", short: "Jun", name: "June" },
  { num: "07", short: "Jul", name: "July" },
  { num: "08", short: "Aug", name: "August" },
  { num: "09", short: "Sep", name: "September" },
  { num: "10", short: "Oct", name: "October" },
  { num: "11", short: "Nov", name: "November" },
  { num: "12", short: "Dec", name: "December" },
];

export default function MonthlyFeeManagementPage() {
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>("12");
  const activeMonth = `${selectedYear}-${selectedMonthNum}`;

  const [viewTab, setViewTab] = useState<
    "MATRIX_12M" | "MONTH_DETAIL" | "DAILY_REPORT" | "CORRECTION_HISTORY"
  >("MATRIX_12M");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [reportDate, setReportDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Payment Record / Edit Modal state
  const [editingCell, setEditingCell] = useState<{
    student: MatrixStudentRow;
    monthYear: string;
    cell: MonthCell;
  } | null>(null);
  const [modalStatus, setModalStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [modalAmount, setModalAmount] = useState<string>("600");
  const [modalMode, setModalMode] = useState<string>("CASH");
  const [modalReceivedBy, setModalReceivedBy] = useState<string>("Admin Desk");
  const [modalRemarks, setModalRemarks] = useState<string>("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 1. 12-Month Matrix Query
  const { data: matrix, isLoading: loadingMatrix } =
    useQuery<FeeLedgerMatrixResponse>({
      queryKey: [
        "admin",
        "fee-ledger-12m",
        selectedYear,
        activeMonth,
        statusFilter,
        search,
        page,
      ],
      queryFn: () =>
        api.get<FeeLedgerMatrixResponse>("/v1/reports/fee-ledger", {
          year: selectedYear,
          active_month: activeMonth,
          status_filter: statusFilter !== "ALL" ? statusFilter : undefined,
          search: search.trim() || undefined,
          page,
          page_size: 50,
        }),
    });

  // 2. Daily Collection Report Query
  const { data: dailyReport } = useQuery<DailyCollectionReport>({
    queryKey: ["admin", "daily-collection", reportDate],
    queryFn: () =>
      api.get<DailyCollectionReport>("/v1/admin/daily-collection", {
        date: reportDate,
      }),
    enabled: viewTab === "DAILY_REPORT",
  });

  // 3. Payment Correction History Query
  const { data: corrections } = useQuery<PaymentCorrectionItem[]>({
    queryKey: ["admin", "payment-corrections"],
    queryFn: () =>
      api.get<PaymentCorrectionItem[]>("/v1/admin/payment-corrections"),
    enabled: viewTab === "CORRECTION_HISTORY",
  });

  const openPaymentModal = (
    student: MatrixStudentRow,
    monthYear: string,
    cell: MonthCell
  ) => {
    setEditingCell({ student, monthYear, cell });
    setModalStatus(cell.status === "PAID" ? "UNPAID" : "PAID");
    setModalAmount(String(cell.amount || student.monthly_fee || 600));
    setModalMode(cell.payment_mode || "CASH");
    setModalReceivedBy(cell.received_by || "Admin Desk");
    setModalRemarks("");
  };

  const handleSavePaymentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;
    setIsSavingPayment(true);
    try {
      await api.post(
        `/v1/admin/students/${editingCell.student.id}/fee-status`,
        {
          status: modalStatus,
          month: editingCell.monthYear,
          amount: Number(modalAmount) || editingCell.student.monthly_fee,
          payment_mode: modalMode,
          received_by: modalReceivedBy.trim() || "Admin Desk",
          remarks: modalRemarks.trim(),
        }
      );
      toast({
        type: "success",
        title: `Fee Record Updated (${editingCell.monthYear})`,
        description: `${editingCell.student.name} marked as ${modalStatus} (${modalMode}).`,
      });
      setEditingCell(null);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Payment Update Failed",
        description:
          err instanceof Error ? err.message : "Could not save fee record.",
      });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const totalPages = matrix
    ? Math.max(1, Math.ceil(matrix.total / matrix.page_size))
    : 1;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <span className="inline-block rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider">
            Section 5 &amp; 6 • 12-Month Fee &amp; Payment Management
          </span>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold">
            Monthly Fee Management ({selectedYear} — All 12 Months)
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Cross-check all 12 months, filter Paid and Unpaid students separately, record Offline Cash or Online payments with receiver name, and download PDF receipts or Excel sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Picker */}
          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
            <Calendar className="h-4 w-4 text-[#FBBF24]" />
            <span className="text-xs font-bold text-[#FBBF24]">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setPage(1);
              }}
              className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden cursor-pointer"
            >
              <option value={2026} className="text-slate-900">
                2026
              </option>
              <option value={2027} className="text-slate-900">
                2027
              </option>
              <option value={2028} className="text-slate-900">
                2028
              </option>
            </select>
          </div>

          {/* Active Month Picker */}
          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
            <span className="text-xs font-bold text-[#FBBF24]">Month:</span>
            <select
              value={selectedMonthNum}
              onChange={(e) => {
                setSelectedMonthNum(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden cursor-pointer"
            >
              {MONTHS_LIST.map((m) => (
                <option key={m.num} value={m.num} className="text-slate-900">
                  {m.name} ({selectedYear}-{m.num})
                </option>
              ))}
            </select>
          </div>

          <a
            href={`/api/backend/v1/admin/export/monthly-fees?month=${activeMonth}&year=${selectedYear}&format=xlsx`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 px-4 py-2.5 text-xs font-extrabold shadow-md"
          >
            <Download className="h-4 w-4" />
            <span>Export Month Excel (.xlsx)</span>
          </a>

          <a
            href="/api/backend/v1/admin/export/payment-history?format=xlsx"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 px-4 py-2.5 text-xs font-extrabold shadow-md"
          >
            <Download className="h-4 w-4" />
            <span>Export All Payments (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Record / Edit Payment Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSavePaymentRecord}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2563EB]">
                  Update Monthly Fee Record ({editingCell.monthYear})
                </span>
                <h3 className="text-lg font-extrabold text-[#1E3A8A]">
                  {editingCell.student.name} (
                  {editingCell.student.student_id || "No ID"})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paid / Unpaid Status
                </label>
                <select
                  value={modalStatus}
                  onChange={(e) =>
                    setModalStatus(e.target.value as "PAID" | "UNPAID")
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-extrabold"
                >
                  <option value="PAID">PAID</option>
                  <option value="UNPAID">UNPAID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={modalMode}
                  onChange={(e) => setModalMode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                >
                  <option value="CASH">CASH (Offline Desk)</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="NET_BANKING">Net Banking</option>
                  <option value="RAZORPAY">Razorpay Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Received By (Staff Name for Offline/Cash Payment) *
                </label>
                <input
                  type="text"
                  required
                  value={modalReceivedBy}
                  onChange={(e) => setModalReceivedBy(e.target.value)}
                  placeholder="Enter name of person receiving payment"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correction / Receipt Remarks (Logged in Correction History)
                </label>
                <input
                  type="text"
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  placeholder="Optional note or receipt remark"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPayment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-white px-5 py-2 text-xs font-extrabold cursor-pointer"
              >
                {isSavingPayment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Fee Record</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap gap-2">
          {(
            [
              {
                id: "MATRIX_12M",
                label: `All 12 Months Matrix (${selectedYear})`,
              },
              {
                id: "MONTH_DETAIL",
                label: `Detailed Month Ledger (${activeMonth})`,
              },
              {
                id: "DAILY_REPORT",
                label: "Daily Collection Report",
              },
              {
                id: "CORRECTION_HISTORY",
                label: "Payment Correction History",
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                viewTab === tab.id
                  ? "bg-[#1E3A8A] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(viewTab === "MATRIX_12M" || viewTab === "MONTH_DETAIL") && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[210px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Student or ID..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs font-medium"
              />
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              {(["ALL", "PAID", "UNPAID"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-extrabold cursor-pointer ${
                    statusFilter === st
                      ? "bg-[#1E3A8A] text-white"
                      : "text-slate-600"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: All 12 Months Matrix */}
      {viewTab === "MATRIX_12M" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          {loadingMatrix || !matrix ? (
            <CardSkeleton />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1E3A8A] text-white uppercase">
                    <tr>
                      <th className="py-3 px-3 font-extrabold sticky left-0 bg-[#1E3A8A] z-10 min-w-[190px]">
                        Student Name &amp; ID
                      </th>
                      <th className="py-3 px-2.5 font-extrabold min-w-[95px]">
                        Course &amp; Fee
                      </th>
                      {MONTHS_LIST.map((m) => {
                        const mKey = `${selectedYear}-${m.num}`;
                        return (
                          <th
                            key={mKey}
                            className={`py-3 px-1.5 text-center font-extrabold min-w-[66px] ${
                              mKey === activeMonth
                                ? "bg-[#F59E0B] text-slate-950"
                                : ""
                            }`}
                          >
                            {m.short}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {matrix.items.map((st) => (
                      <tr key={st.id} className="hover:bg-blue-50/30">
                        <td className="py-2.5 px-3 sticky left-0 bg-white z-10 border-r border-slate-100">
                          <p className="font-extrabold text-slate-900 truncate max-w-[180px]">
                            {st.name}
                          </p>
                          <p className="font-mono text-[11px] font-bold text-[#1E3A8A]">
                            {st.student_id || "Unassigned ID"}
                          </p>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span className="rounded bg-blue-50 text-[#1E3A8A] px-1.5 py-0.5 text-[10px] font-extrabold">
                            {st.course}
                          </span>
                          <p className="font-extrabold text-slate-800 mt-0.5">
                            ₹{st.monthly_fee}
                          </p>
                        </td>
                        {MONTHS_LIST.map((m) => {
                          const mKey = `${selectedYear}-${m.num}`;
                          const cell = st.months[mKey] || {
                            id: null,
                            status: "UNPAID",
                            amount: st.monthly_fee,
                          };
                          const isPaid = cell.status === "PAID";
                          return (
                            <td
                              key={mKey}
                              className={`py-2 px-1 text-center ${
                                mKey === activeMonth ? "bg-amber-50/60" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => openPaymentModal(st, mKey, cell)}
                                className={`w-full rounded-lg px-1.5 py-1 text-[10px] font-extrabold transition-all cursor-pointer ${
                                  isPaid
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                    : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"
                                }`}
                              >
                                {isPaid ? "PAID" : "UNPAID"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 text-xs text-slate-600">
                <span>
                  Total Students: <strong>{matrix.total}</strong> (Page {page}{" "}
                  of {totalPages})
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Detailed Single-Month Ledger (Section 5 Required Columns) */}
      {viewTab === "MONTH_DETAIL" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          {loadingMatrix || !matrix ? (
            <CardSkeleton />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A8A] text-white uppercase">
                  <tr>
                    <th className="py-3 px-4 font-extrabold">Student Name</th>
                    <th className="py-3 px-4 font-extrabold">Student ID</th>
                    <th className="py-3 px-4 font-extrabold">Course</th>
                    <th className="py-3 px-4 font-extrabold">Month</th>
                    <th className="py-3 px-4 font-extrabold">Amount</th>
                    <th className="py-3 px-4 font-extrabold">Payment Date</th>
                    <th className="py-3 px-4 font-extrabold">Payment Mode</th>
                    <th className="py-3 px-4 font-extrabold">Received By</th>
                    <th className="py-3 px-4 font-extrabold">Status</th>
                    <th className="py-3 px-4 font-extrabold text-right">
                      Action / Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {matrix.items.map((st) => {
                    const cell = st.months[activeMonth] || {
                      id: null,
                      status: "UNPAID",
                      amount: st.monthly_fee,
                    };
                    const isPaid = cell.status === "PAID";
                    return (
                      <tr key={st.id} className="hover:bg-blue-50/30">
                        <td className="py-3 px-4 font-extrabold text-slate-900">
                          {st.name}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#1E3A8A]">
                          {st.student_id || "—"}
                        </td>
                        <td className="py-3 px-4 font-bold">{st.course}</td>
                        <td className="py-3 px-4 font-bold">
                          {matrix.active_month_label}
                        </td>
                        <td className="py-3 px-4 font-extrabold">
                          ₹{Number(cell.amount || st.monthly_fee).toFixed(0)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {cell.payment_date
                            ? String(cell.payment_date).slice(0, 10)
                            : "—"}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          {isPaid ? cell.payment_mode || "CASH" : "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {isPaid ? cell.received_by || "Admin Desk" : "—"}
                        </td>
                        <td className="py-3 px-4">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 font-extrabold">
                              <CheckCircle2 className="h-3 w-3" />
                              PAID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 font-extrabold">
                              <AlertCircle className="h-3 w-3" />
                              UNPAID
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openPaymentModal(st, activeMonth, cell)
                              }
                              className="rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white px-2.5 py-1 text-[11px] font-extrabold cursor-pointer"
                            >
                              {isPaid ? "Edit / Unmark" : "Record Payment"}
                            </button>
                            {isPaid && cell.id && (
                              <a
                                href={`/api/backend/v1/payments/${cell.id}/receipt.pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#1E3A8A] px-2.5 py-1 text-[11px] font-extrabold"
                              >
                                <FileText className="h-3 w-3" />
                                <span>Receipt PDF</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Daily Collection Report */}
      {viewTab === "DAILY_REPORT" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#1E3A8A]">
                Daily Fee Collection Report
              </h2>
              <p className="text-xs text-slate-500">
                Breakdown of Cash and Online payments collected on the selected date.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Date:</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold"
              />
            </div>
          </div>

          {dailyReport && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase">
                    Total Collected ({dailyReport.date})
                  </span>
                  <p className="mt-1 text-2xl font-black text-[#1E3A8A]">
                    ₹{dailyReport.total_collected.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {dailyReport.total_transactions} transactions
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <span className="text-xs font-bold text-emerald-700 uppercase">
                    Cash Received
                  </span>
                  <p className="mt-1 text-2xl font-black text-emerald-700">
                    ₹{dailyReport.cash_collected.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                  <span className="text-xs font-bold text-[#2563EB] uppercase">
                    Online Payments (Razorpay / UPI)
                  </span>
                  <p className="mt-1 text-2xl font-black text-[#2563EB]">
                    ₹{dailyReport.online_collected.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase">
                    <tr>
                      <th className="py-3 px-4 font-bold">Student</th>
                      <th className="py-3 px-4 font-bold">Student ID</th>
                      <th className="py-3 px-4 font-bold">Course</th>
                      <th className="py-3 px-4 font-bold">Fee Month</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">Mode</th>
                      <th className="py-3 px-4 font-bold">Received By</th>
                      <th className="py-3 px-4 font-bold text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyReport.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-slate-500"
                        >
                          No fee payments recorded on {dailyReport.date}.
                        </td>
                      </tr>
                    ) : (
                      dailyReport.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 px-4 font-bold">
                            {item.student_name}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#1E3A8A]">
                            {item.student_id}
                          </td>
                          <td className="py-3 px-4">{item.course}</td>
                          <td className="py-3 px-4">{item.month_label}</td>
                          <td className="py-3 px-4 font-extrabold">
                            ₹{item.amount}
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {item.payment_mode}
                          </td>
                          <td className="py-3 px-4">{item.received_by}</td>
                          <td className="py-3 px-4 text-right">
                            <a
                              href={`/api/backend/v1/payments/${item.id}/receipt.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#2563EB] font-extrabold hover:underline"
                            >
                              Download PDF
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: Payment Correction History */}
      {viewTab === "CORRECTION_HISTORY" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="h-5 w-5 text-[#1E3A8A]" />
            <div>
              <h2 className="text-lg font-extrabold text-[#1E3A8A]">
                Payment Correction &amp; Audit History
              </h2>
              <p className="text-xs text-slate-500">
                Permanent log of every fee record update, status toggle, or amount correction made by Super Admin or Fees Admin.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                  <th className="py-3 px-4 font-bold">Student</th>
                  <th className="py-3 px-4 font-bold">Month</th>
                  <th className="py-3 px-4 font-bold">Change</th>
                  <th className="py-3 px-4 font-bold">Amount</th>
                  <th className="py-3 px-4 font-bold">Mode &amp; Receiver</th>
                  <th className="py-3 px-4 font-bold">Updated By</th>
                  <th className="py-3 px-4 font-bold">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!corrections || corrections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No payment corrections logged yet.
                    </td>
                  </tr>
                ) : (
                  corrections.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {String(c.created_at).slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {c.student_name} ({c.student_id})
                      </td>
                      <td className="py-3 px-4">{c.month_label}</td>
                      <td className="py-3 px-4 font-extrabold">
                        {c.previous_status} → {c.new_status}
                      </td>
                      <td className="py-3 px-4 font-bold">₹{c.new_amount}</td>
                      <td className="py-3 px-4">
                        {c.payment_mode} ({c.received_by})
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {c.updated_by} ({c.updated_by_role})
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.remarks}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
