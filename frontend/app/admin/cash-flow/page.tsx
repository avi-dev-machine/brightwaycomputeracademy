"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Trash2,
  Calendar,
  Loader2,
  ShieldAlert,
  Banknote,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";

interface CashFlowDashboard {
  year: number;
  active_month: string;
  active_month_label: string;
  target_date: string;
  total_income: number;
  total_expenses: number;
  total_balance: number;
  total_cash_received: number;
  total_online_received: number;
  daily: {
    date: string;
    income: number;
    expenses: number;
    balance: number;
  };
  monthly: {
    month_year: string;
    month_label: string;
    income: number;
    cash_received: number;
    online_received: number;
    expenses: number;
    balance: number;
  };
  yearly: {
    year: number;
    income: number;
    expenses: number;
    balance: number;
  };
  monthly_breakdown: Array<{
    month_year: string;
    month_label: string;
    income: number;
    cash_income: number;
    online_income: number;
    expenses: number;
    balance: number;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    category: string;
    amount: number;
    payment_mode: string;
    expense_date: string;
    recorded_by: string;
  }>;
}

const MONTHS_LIST = [
  { num: "01", name: "January" },
  { num: "02", name: "February" },
  { num: "03", name: "March" },
  { num: "04", name: "April" },
  { num: "05", name: "May" },
  { num: "06", name: "June" },
  { num: "07", name: "July" },
  { num: "08", name: "August" },
  { num: "09", name: "September" },
  { num: "10", name: "October" },
  { num: "11", name: "November" },
  { num: "12", name: "December" },
];

export default function CashFlowManagementPage() {
  const [cashflowPassword, setCashflowPassword] = useState("");
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>("12");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const activeMonth = `${selectedYear}-${selectedMonthNum}`;

  // New Expense Form state
  const [expDesc, setExpDesc] = useState("");
  const [expCategory, setExpCategory] = useState("INSTITUTE_EXPENSE");
  const [expAmount, setExpAmount] = useState("");
  const [expMode, setExpMode] = useState("CASH");
  const [expDate, setExpDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      await api.post("/v1/admin/cash-flow/unlock", {
        password: cashflowPassword.trim(),
      });
      setUnlockedPassword(cashflowPassword.trim());
      toast({
        type: "success",
        title: "Cash Flow Unlocked",
        description: "Super Admin secondary security verification passed.",
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Access Denied",
        description:
          err instanceof Error
            ? err.message
            : "Invalid Cash Flow security password.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const { data: cashflow, isLoading } = useQuery<CashFlowDashboard>({
    queryKey: [
      "admin",
      "cash-flow",
      unlockedPassword,
      selectedYear,
      activeMonth,
      selectedDate,
    ],
    queryFn: () =>
      api.get<CashFlowDashboard>("/v1/admin/cash-flow", {
        year: selectedYear,
        month: activeMonth,
        date: selectedDate,
        cashflow_password: unlockedPassword || "",
      }),
    enabled: !!unlockedPassword,
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedPassword) return;
    setIsAddingExpense(true);
    try {
      await api.post(
        "/v1/admin/cash-flow/expenses",
        {
          description: expDesc.trim(),
          category: expCategory,
          amount: Number(expAmount),
          payment_mode: expMode,
          expense_date: expDate,
        },
        { query: { cashflow_password: unlockedPassword } }
      );
      toast({
        type: "success",
        title: "Expense Recorded",
        description: `Added ₹${expAmount} (${expDesc}).`,
      });
      setExpDesc("");
      setExpAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin", "cash-flow"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Could Not Add Expense",
        description:
          err instanceof Error ? err.message : "Failed to record expense.",
      });
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!unlockedPassword) return;
    try {
      await api.delete(`/v1/admin/cash-flow/expenses/${expenseId}`, {
        query: { cashflow_password: unlockedPassword },
      });
      toast({
        type: "success",
        title: "Expense Deleted",
        description: "Removed expense entry and recalculated balance.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "cash-flow"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Delete Failed",
        description:
          err instanceof Error ? err.message : "Could not delete expense.",
      });
    }
  };

  // Password Gate Screen before opening Cash Flow
  if (!unlockedPassword) {
    return (
      <div className="mx-auto max-w-md py-16">
        <form
          onSubmit={handleUnlock}
          className="rounded-2xl border-2 border-[#1E3A8A]/20 bg-white p-8 shadow-xl space-y-5 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E3A8A] text-[#FBBF24] shadow-md">
            <Lock className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-3 py-0.5 text-xs font-extrabold uppercase">
              <ShieldAlert className="h-3.5 w-3.5 text-[#F59E0B]" />
              Super Admin Exclusive • Secondary Lock
            </span>
            <h1 className="font-display text-2xl font-black text-[#1E3A8A]">
              Cash Flow Management
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter the additional Cash Flow security password to access institute income, expenses, and net balance reports.
            </p>
          </div>

          <div className="text-left">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cash Flow Security Password *
            </label>
            <input
              type="password"
              required
              autoFocus
              value={cashflowPassword}
              onChange={(e) => setCashflowPassword(e.target.value)}
              placeholder="Enter Cash Flow Password (e.g. Brightway@Cash2026!)"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono font-bold focus:border-[#2563EB] focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-extrabold py-3 px-4 text-xs shadow-md transition-colors cursor-pointer"
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#FBBF24]" />
            ) : (
              <Unlock className="h-4 w-4 text-[#FBBF24]" />
            )}
            <span>
              {isVerifying
                ? "Verifying Security Password..."
                : "Unlock Cash Flow Management"}
            </span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase">
            <Unlock className="h-3.5 w-3.5" />
            Super Admin Cash Flow Management (Unlocked)
          </span>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold">
            Institute Cash Flow, Income &amp; Expense Ledger
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Automatically reflects verified fee collections (Cash vs. Online Razorpay) and recorded expenses across Daily, Monthly, and Yearly periods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
            <Calendar className="h-4 w-4 text-[#FBBF24]" />
            <span className="text-xs font-bold text-[#FBBF24]">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
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

          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
            <span className="text-xs font-bold text-[#FBBF24]">Month:</span>
            <select
              value={selectedMonthNum}
              onChange={(e) => setSelectedMonthNum(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden cursor-pointer"
            >
              {MONTHS_LIST.map((m) => (
                <option key={m.num} value={m.num} className="text-slate-900">
                  {m.name} ({selectedYear}-{m.num})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-1.5">
            <span className="text-xs font-bold text-[#FBBF24]">Day:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setUnlockedPassword(null);
              setCashflowPassword("");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/90 hover:bg-red-600 text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Lock Cash Flow</span>
          </button>
        </div>
      </div>

      {isLoading || !cashflow ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* Master All-Time & Payment Mode Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-700">
                  Total Income
                </span>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-700">
                ₹{cashflow.total_income.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                All verified fee collections
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-800">
                  Cash Received
                </span>
                <Banknote className="h-5 w-5 text-emerald-700" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-800">
                ₹{cashflow.total_cash_received.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Offline counter cash
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[#1E3A8A]">
                  Online Payments
                </span>
                <CreditCard className="h-5 w-5 text-[#2563EB]" />
              </div>
              <p className="mt-2 text-2xl font-black text-[#1E3A8A]">
                ₹{cashflow.total_online_received.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Razorpay / UPI / Cards
              </p>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-rose-700">
                  Total Expenses
                </span>
                <TrendingDown className="h-5 w-5 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-rose-700">
                ₹{cashflow.total_expenses.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {cashflow.expenses.length} recorded expenses
              </p>
            </div>

            <div className="rounded-2xl border-2 border-[#1E3A8A] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-[#1E3A8A]">
                  Net Total Balance
                </span>
                <Wallet className="h-5 w-5 text-[#F59E0B]" />
              </div>
              <p
                className={`mt-2 text-2xl font-black ${
                  cashflow.total_balance >= 0
                    ? "text-[#1E3A8A]"
                    : "text-rose-700"
                }`}
              >
                ₹{cashflow.total_balance.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Total Income − Total Expenses
              </p>
            </div>
          </div>

          {/* Daily, Monthly & Yearly Cash Flow Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Daily Cash Flow */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <span className="rounded-lg bg-blue-50 text-[#1E3A8A] px-2.5 py-0.5 text-[11px] font-extrabold uppercase">
                Daily Cash Flow ({cashflow.daily.date})
              </span>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <div>
                  <p className="text-slate-500">Income</p>
                  <p className="font-extrabold text-emerald-700 text-base">
                    ₹{cashflow.daily.income.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Expenses</p>
                  <p className="font-extrabold text-rose-600 text-base">
                    ₹{cashflow.daily.expenses.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Balance</p>
                  <p className="font-black text-[#1E3A8A] text-base">
                    ₹{cashflow.daily.balance.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly Cash Flow */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <span className="rounded-lg bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[11px] font-extrabold uppercase">
                Monthly Cash Flow ({cashflow.monthly.month_label})
              </span>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <div>
                  <p className="text-slate-500">Income</p>
                  <p className="font-extrabold text-emerald-700 text-base">
                    ₹{cashflow.monthly.income.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Expenses</p>
                  <p className="font-extrabold text-rose-600 text-base">
                    ₹{cashflow.monthly.expenses.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Balance</p>
                  <p className="font-black text-[#1E3A8A] text-base">
                    ₹{cashflow.monthly.balance.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>

            {/* Yearly Cash Flow */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2">
              <span className="rounded-lg bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[11px] font-extrabold uppercase">
                Yearly Cash Flow ({cashflow.yearly.year})
              </span>
              <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                <div>
                  <p className="text-slate-500">Income</p>
                  <p className="font-extrabold text-emerald-700 text-base">
                    ₹{cashflow.yearly.income.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Expenses</p>
                  <p className="font-extrabold text-rose-600 text-base">
                    ₹{cashflow.yearly.expenses.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Balance</p>
                  <p className="font-black text-[#1E3A8A] text-base">
                    ₹{cashflow.yearly.balance.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Add Expense Form + Expenses Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddExpense}
              className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 h-fit"
            >
              <h2 className="text-base font-extrabold text-[#1E3A8A]">
                Add Institute Expense
              </h2>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Electricity Bill, Lab Maintenance, Rent"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={expMode}
                    onChange={(e) => setExpMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  >
                    <option value="CASH">CASH</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  >
                    <option value="INSTITUTE_EXPENSE">General Expense</option>
                    <option value="LAB_HARDWARE">Lab &amp; Computers</option>
                    <option value="ELECTRICITY_INTERNET">
                      Electricity &amp; Wi-Fi
                    </option>
                    <option value="FACULTY_SALARY">Faculty &amp; Staff</option>
                    <option value="RGYCSM_AFFILIATION">
                      RGYCSM Exam / Affiliation
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isAddingExpense}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-white py-2.5 px-4 text-xs font-extrabold cursor-pointer"
              >
                {isAddingExpense ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 text-[#FBBF24]" />
                )}
                <span>Record Expense</span>
              </button>
            </form>

            {/* Recorded Expenses Table */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <h2 className="text-base font-extrabold text-[#1E3A8A]">
                Recorded Expenses ({cashflow.expenses.length})
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 uppercase">
                    <tr>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Description</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Mode</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashflow.expenses.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-500"
                        >
                          No expenses recorded yet.
                        </td>
                      </tr>
                    ) : (
                      cashflow.expenses.map((exp) => (
                        <tr key={exp.id}>
                          <td className="py-3 px-4 font-mono">
                            {exp.expense_date}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {exp.description}
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold">
                            {exp.payment_mode}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-rose-700">
                            ₹{Number(exp.amount).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="rounded-lg bg-red-50 hover:bg-red-100 text-red-700 p-1.5 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 12-Month Income & Expense Report Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-[#1E3A8A]">
              12-Month Income vs. Expense Report ({selectedYear})
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1E3A8A] text-white uppercase">
                  <tr>
                    <th className="py-3 px-4 font-extrabold">Month</th>
                    <th className="py-3 px-4 font-extrabold">Cash Received</th>
                    <th className="py-3 px-4 font-extrabold">
                      Online Received
                    </th>
                    <th className="py-3 px-4 font-extrabold">Total Income</th>
                    <th className="py-3 px-4 font-extrabold">Total Expenses</th>
                    <th className="py-3 px-4 font-extrabold">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cashflow.monthly_breakdown.map((m) => (
                    <tr key={m.month_year} className="hover:bg-blue-50/30">
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {m.month_label}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        ₹{m.cash_income.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#2563EB]">
                        ₹{m.online_income.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-emerald-800">
                        ₹{m.income.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-rose-700">
                        ₹{m.expenses.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={`py-3 px-4 font-black ${
                          m.balance >= 0 ? "text-[#1E3A8A]" : "text-rose-700"
                        }`}
                      >
                        ₹{m.balance.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
