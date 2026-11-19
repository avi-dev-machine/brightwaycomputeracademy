"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Search,
  Upload,
  Send,
  MessageSquare,
  Mail,
  Smartphone,
  Filter,
  Loader2,
  IdCard,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Save,
  X,
  Copy,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";

interface CourseStat {
  batch: string;
  course?: string;
  student_count: number;
  paid_count: number;
  unpaid_count: number;
  collected_amount: number;
  pending_amount: number;
}

interface DashboardAnalytics {
  active_month: string;
  active_month_label?: string;
  available_months?: Array<{ month_year: string; month_label: string }>;
  selected_batch: string;
  total_students: number;
  assigned_id_count?: number;
  missing_id_count?: number;
  paid_students_count: number;
  unpaid_students_count: number;
  monthly_revenue_collected: number;
  monthly_pending_dues: number;
  expected_monthly_revenue: number;
  all_time_revenue_collected: number;
  batches: CourseStat[];
}

interface StudentRow {
  id: string;
  name: string;
  student_id: string;
  has_student_id: boolean;
  password: string;
  initial_passcode: string;
  contact_number: string;
  course: string;
  batch: string;
  monthly_fee: number;
  fee_status: "PAID" | "UNPAID";
  current_month_status: "PAID" | "UNPAID";
  month: string;
  current_month: string;
  month_label: string;
}

interface PaginatedStudents {
  items: StudentRow[];
  meta: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

const MONTH_OPTIONS = [
  { value: "2027-12", label: "December 2027 (2027-12)" },
  { value: "2028-01", label: "January 2028 (2028-01)" },
  { value: "2028-02", label: "February 2028 (2028-02)" },
];

export default function AdminDashboardPage() {
  const [selectedCourse, setSelectedCourse] = useState<string>("ALL");
  const [activeMonth, setActiveMonth] = useState<string>("2027-12");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [idFilter, setIdFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [sendingRowId, setSendingRowId] = useState<string | null>(null);
  const [togglingRowId, setTogglingRowId] = useState<string | null>(null);

  // Add Student Modal/Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newCourse, setNewCourse] = useState("ADOAP");
  const [newFee, setNewFee] = useState("600");
  const [newFeeStatus, setNewFeeStatus] = useState<"UNPAID" | "PAID">("UNPAID");

  // Edit Student Modal/Inline state
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStudentId, setEditStudentId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editFee, setEditFee] = useState("");
  const [editFeeStatus, setEditFeeStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 1. Master Analytics Query (`/api/v1/admin/dashboard`)
  const { data: analytics, isLoading: loadingAnalytics } =
    useQuery<DashboardAnalytics>({
      queryKey: ["admin", "dashboard", activeMonth, selectedCourse],
      queryFn: () =>
        api.get<DashboardAnalytics>("/v1/admin/dashboard", {
          month: activeMonth,
          ...(selectedCourse !== "ALL" ? { course: selectedCourse } : {}),
        }),
    });

  // 2. Clean Student Records Query (`/api/v1/admin/students`)
  const { data: studentsPage, isLoading: loadingStudents } =
    useQuery<PaginatedStudents>({
      queryKey: [
        "admin",
        "students-table",
        activeMonth,
        selectedCourse,
        statusFilter,
        idFilter,
        search,
        page,
      ],
      queryFn: () =>
        api.get<PaginatedStudents>("/v1/admin/students", {
          month: activeMonth,
          course: selectedCourse !== "ALL" ? selectedCourse : undefined,
          fee_status: statusFilter !== "ALL" ? statusFilter : undefined,
          id_status: idFilter !== "ALL" ? idFilter : undefined,
          search: search.trim() || undefined,
          page,
          page_size: 50,
        }),
    });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const openEditModal = (st: StudentRow) => {
    setEditingStudent(st);
    setEditName(st.name);
    setEditStudentId(st.student_id || "");
    setEditPassword(st.password || st.initial_passcode || "");
    setEditContact(st.contact_number || "");
    setEditCourse(st.course || st.batch || "GENERAL");
    setEditFee(String(st.monthly_fee ?? 600));
    setEditFeeStatus(st.fee_status || st.current_month_status || "UNPAID");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsSavingEdit(true);
    try {
      await api.put(`/v1/admin/students/${editingStudent.id}`, {
        name: editName.trim(),
        student_id: editStudentId.trim().toUpperCase(),
        password: editPassword.trim(),
        contact_number: editContact.trim(),
        course: editCourse.trim().toUpperCase(),
        monthly_fee: Number(editFee) || 600,
        fee_status: editFeeStatus,
        month: activeMonth,
      });
      toast({
        type: "success",
        title: "Student Record Updated",
        description: `Saved ${editName} (${editStudentId || "Unassigned ID"}) for ${activeMonth}.`,
      });
      setEditingStudent(null);
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Could Not Update Student",
        description:
          err instanceof Error ? err.message : "Failed to update student.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/v1/admin/students", {
        name: newName.trim(),
        student_id: newStudentId.trim().toUpperCase(),
        password: newPassword.trim() || undefined,
        contact_number: newContact.trim(),
        course: newCourse.trim().toUpperCase() || "GENERAL",
        monthly_fee: Number(newFee) || 600,
        fee_status: newFeeStatus,
        month: activeMonth,
      });
      toast({
        type: "success",
        title: "Student Added",
        description: `Created ${newName} (${newStudentId || "Unassigned ID"}).`,
      });
      setShowAddForm(false);
      setNewName("");
      setNewStudentId("");
      setNewPassword("");
      setNewContact("");
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Could Not Add Student",
        description:
          err instanceof Error ? err.message : "Failed to create student.",
      });
    }
  };

  // Toggle PAID / UNPAID for the active month
  const handleToggleFeeStatus = async (student: StudentRow) => {
    setTogglingRowId(student.id);
    const currentStatus = student.fee_status || student.current_month_status;
    const nextStatus = currentStatus === "PAID" ? "UNPAID" : "PAID";
    try {
      await api.post(`/v1/admin/students/${student.id}/fee-status`, {
        status: nextStatus,
        month: activeMonth,
        amount: student.monthly_fee,
      });
      toast({
        type: "success",
        title: `Fees Marked as ${nextStatus}`,
        description: `${student.name} (${student.student_id || "No ID"}) — ${activeMonth}`,
      });
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Update Failed",
        description:
          err instanceof Error ? err.message : "Could not update fee status.",
      });
    } finally {
      setTogglingRowId(null);
    }
  };

  // Streaming CSV Upload Handler
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dry_run", "false");

      const res = await fetch("/api/backend/v1/imports/csv", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || "CSV import failed.");
      }

      const d = json.data;
      toast({
        type: "success",
        title: "CSV Imported Successfully",
        description: `Processed ${d.total_rows} rows (${d.inserted_rows} inserted, ${d.updated_rows} updated).`,
      });
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "CSV Ingestion Error",
        description:
          err instanceof Error ? err.message : "Could not parse CSV file.",
      });
    } finally {
      setIsUploadingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  // Individual Multi-Channel Reminder Dispatch
  const handleSendSingleReminder = async (
    student: StudentRow,
    channel: "WHATSAPP" | "SMS" | "EMAIL"
  ) => {
    setSendingRowId(`${student.id}-${channel}`);
    try {
      const result = await api.post<{
        whatsapp_url?: string | null;
        message: string;
        channels: Array<{ channel: string; mailto_url?: string }>;
      }>("/v1/notifications/send-reminder", {
        student_id: student.student_id || student.id,
        month_year: activeMonth,
        channels: [channel],
      });

      toast({
        type: "success",
        title: `${channel} Reminder Dispatched`,
        description: `Sent ${activeMonth} payment reminder to ${student.name}.`,
      });

      if (channel === "WHATSAPP" && result.whatsapp_url) {
        window.open(result.whatsapp_url, "_blank", "noopener,noreferrer");
      } else if (channel === "EMAIL") {
        const emailCh = result.channels?.find((c) => c.channel === "EMAIL");
        if (emailCh?.mailto_url) {
          window.open(emailCh.mailto_url, "_self");
        }
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Reminder Error",
        description:
          err instanceof Error ? err.message : "Failed to dispatch reminder.",
      });
    } finally {
      setSendingRowId(null);
    }
  };

  // Bulk Multi-Channel Reminder Dispatcher for Unpaid Dues
  const handleBulkReminders = async (channels: string[]) => {
    setIsSendingBulk(true);
    try {
      const res = await api.post<{
        total_unpaid_targeted: number;
        sent_count: number;
      }>("/v1/notifications/bulk-reminders", {
        month_year: activeMonth,
        batch: selectedCourse !== "ALL" ? selectedCourse : undefined,
        channels,
        limit: 200,
      });

      toast({
        type: "success",
        title: "Bulk Reminders Dispatched",
        description: `Sent reminders to ${res.sent_count} unpaid students for ${activeMonth}.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Bulk Dispatch Failed",
        description:
          err instanceof Error
            ? err.message
            : "Could not dispatch bulk reminders.",
      });
    } finally {
      setIsSendingBulk(false);
    }
  };

  const activeMonthLabel =
    analytics?.active_month_label ||
    MONTH_OPTIONS.find((m) => m.value === activeMonth)?.label ||
    activeMonth;

  return (
    <div className="space-y-6">
      {/* Top Action Header: Active Month Rollover Selector + Add Student + CSV Ingestion */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] via-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="inline-block rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider">
              Active Month: {activeMonthLabel}
            </span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold">
              Brightway Computer Academy — Master Admin Portal
            </h2>
            <p className="text-xs text-blue-100 mt-1">
              Manage student records (NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES, MONTH). When December 2027 ends and switches to January 2028, December&apos;s fee records remain safely archived in the backend.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Active Month Selector (Dec 2027 -> Jan 2028 Rollover) */}
            <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
              <Calendar className="h-4 w-4 text-[#FBBF24]" />
              <span className="text-xs font-bold text-[#FBBF24]">Month:</span>
              <select
                value={activeMonth}
                onChange={(e) => {
                  setActiveMonth(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden cursor-pointer"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value} className="text-slate-900">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#1E3A8A] hover:bg-blue-50 px-4 py-2.5 text-xs font-extrabold shadow-md transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{showAddForm ? "Close Form" : "Add Student"}</span>
            </button>

            {/* Streaming CSV Ingestion Button */}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={isUploadingCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 px-4 py-2.5 text-xs font-extrabold shadow-md transition-colors cursor-pointer"
            >
              {isUploadingCsv ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>{isUploadingCsv ? "Importing..." : "Import CSV"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add New Student Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateStudent}
          className="rounded-2xl border-2 border-[#2563EB]/30 bg-blue-50/50 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#1E3A8A] uppercase tracking-wider">
              Add New Student Record ({activeMonthLabel})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                NAME *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Student Name"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                STUDENT ID
              </label>
              <input
                type="text"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                placeholder="e.g. RG240099"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                PASSWORD
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Auto if blank"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                CONTACT NO.
              </label>
              <input
                type="text"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                placeholder="10-digit phone"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                COURSE
              </label>
              <input
                type="text"
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                placeholder="e.g. ADOAP, DCAE"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                FEE (₹) &amp; STATUS
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  className="w-1/2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold"
                />
                <select
                  value={newFeeStatus}
                  onChange={(e) =>
                    setNewFeeStatus(e.target.value as "PAID" | "UNPAID")
                  }
                  className="w-1/2 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-extrabold"
                >
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-white py-2.5 px-4 text-xs font-extrabold cursor-pointer"
            >
              Save Student
            </button>
          </div>
        </form>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2563EB]">
                  Edit Student Record
                </span>
                <h3 className="text-lg font-extrabold text-[#1E3A8A]">
                  {editingStudent.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NAME *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  STUDENT ID (Add or Edit)
                </label>
                <input
                  type="text"
                  value={editStudentId}
                  onChange={(e) => setEditStudentId(e.target.value.toUpperCase())}
                  placeholder="Enter Student ID (e.g. RG240017)"
                  className="w-full rounded-xl border-2 border-[#2563EB] bg-blue-50/30 px-3 py-2 text-xs font-mono font-extrabold text-[#1E3A8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PASSWORD
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Student login password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CONTACT NO.
                </label>
                <input
                  type="text"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  placeholder="10-digit contact number"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  COURSE
                </label>
                <input
                  type="text"
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  MONTHLY FEE (₹)
                </label>
                <input
                  type="number"
                  value={editFee}
                  onChange={(e) => setEditFee(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  FEES (PAID / UNPAID)
                </label>
                <select
                  value={editFeeStatus}
                  onChange={(e) =>
                    setEditFeeStatus(e.target.value as "PAID" | "UNPAID")
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-extrabold"
                >
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  MONTH
                </label>
                <input
                  type="text"
                  disabled
                  value={`${activeMonthLabel} (${activeMonth})`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-white px-5 py-2 text-xs font-extrabold cursor-pointer"
              >
                {isSavingEdit ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Analytics KPI Cards */}
      {loadingAnalytics || !analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Students
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1E3A8A]">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-[#1E3A8A]">
              {analytics.total_students.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              <strong>{analytics.assigned_id_count ?? 0}</strong> with ID •{" "}
              <button
                type="button"
                onClick={() => {
                  setIdFilter(idFilter === "MISSING" ? "ALL" : "MISSING");
                  setPage(1);
                }}
                className="text-amber-700 font-bold underline cursor-pointer"
              >
                {analytics.missing_id_count ?? 0} missing ID
              </button>
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Fees Paid ({activeMonth})
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-emerald-700">
              ₹{analytics.monthly_revenue_collected.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-slate-600 font-medium">
              <strong>{analytics.paid_students_count}</strong> students PAID for{" "}
              {analytics.active_month_label || activeMonth}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Fees Unpaid ({activeMonth})
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#F59E0B]">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-amber-700">
              ₹{analytics.monthly_pending_dues.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-slate-600 font-medium">
              <strong>{analytics.unpaid_students_count}</strong> students UNPAID
              for {analytics.active_month_label || activeMonth}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Backend Archived Revenue
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E3A8A] text-[#FBBF24]">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-[#1E3A8A]">
              ₹{analytics.all_time_revenue_collected.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Preserved across all months in MongoDB
            </p>
          </div>
        </div>
      )}

      {/* Quick Filters by Course */}
      {analytics && analytics.batches.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E3A8A]">
              <Filter className="h-3.5 w-3.5 text-[#F59E0B]" />
              Filter by Course ({analytics.batches.length} Courses)
            </span>
            {selectedCourse !== "ALL" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCourse("ALL");
                  setPage(1);
                }}
                className="text-xs font-bold text-[#2563EB] hover:underline cursor-pointer"
              >
                Show All Courses
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCourse("ALL");
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                selectedCourse === "ALL"
                  ? "bg-[#1E3A8A] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Courses ({analytics.total_students})
            </button>

            {analytics.batches.map((b) => {
              const active = selectedCourse === b.batch;
              return (
                <button
                  key={b.batch}
                  type="button"
                  onClick={() => {
                    setSelectedCourse(b.batch);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-[#2563EB] text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-[#1E3A8A]"
                  }`}
                >
                  <span>{b.batch}</span>
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-extrabold ${
                      active
                        ? "bg-[#FBBF24] text-slate-950"
                        : "bg-white text-slate-600"
                    }`}
                  >
                    {b.student_count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Channel Notification Dispatcher Bar */}
      <div className="rounded-2xl border-2 border-[#F59E0B]/60 bg-amber-50/50 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#F59E0B] text-slate-950 px-2.5 py-0.5 text-[11px] font-extrabold uppercase">
              Fee Reminder Dispatcher
            </span>
            <span className="text-xs font-bold text-slate-700">
              Month: <strong>{activeMonthLabel}</strong> • Course:{" "}
              <strong>{selectedCourse}</strong>
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Send reminders to{" "}
            <strong>{analytics?.unpaid_students_count ?? 0} UNPAID students</strong>{" "}
            for {activeMonthLabel}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSendingBulk}
            onClick={() => handleBulkReminders(["WHATSAPP"])}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Bulk WhatsApp</span>
          </button>
          <button
            type="button"
            disabled={isSendingBulk}
            onClick={() => handleBulkReminders(["SMS"])}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Bulk SMS</span>
          </button>
          <button
            type="button"
            disabled={isSendingBulk}
            onClick={() => handleBulkReminders(["EMAIL"])}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-950 disabled:opacity-60 text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Bulk Email</span>
          </button>
          <button
            type="button"
            disabled={isSendingBulk}
            onClick={() => handleBulkReminders(["WHATSAPP", "SMS", "EMAIL"])}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 disabled:opacity-60 text-[#FBBF24] px-3.5 py-2 text-xs font-extrabold cursor-pointer"
          >
            {isSendingBulk ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Send All</span>
          </button>
        </div>
      </div>

      {/* Main Canonical Database Table: NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES (PAID/UNPAID), MONTH */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#1E3A8A]">
              Student Database &amp; Fee Status ({activeMonthLabel})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Columns: <strong>NAME, STUDENT ID, PASSWORD, CONTACT NO., COURSE, FEES (PAID/UNPAID), MONTH</strong>. Click <strong>Edit / Add ID</strong> on any row to add missing Student IDs or edit details.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[230px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Name, ID, Phone, Course..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
              />
            </div>

            {/* Student ID Filter (All / Assigned / Missing ID) */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              {(
                [
                  { key: "ALL", label: "All IDs" },
                  { key: "ASSIGNED", label: "Has ID" },
                  { key: "MISSING", label: "Missing ID" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setIdFilter(item.key);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                    idFilter === item.key
                      ? "bg-[#2563EB] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Active Month Fee Status Filter */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              {(["ALL", "PAID", "UNPAID"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                    statusFilter === st
                      ? "bg-[#1E3A8A] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadingStudents || !studentsPage ? (
          <CardSkeleton />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#1E3A8A] text-white uppercase">
                  <tr>
                    <th className="py-3.5 px-4 font-extrabold">NAME</th>
                    <th className="py-3.5 px-4 font-extrabold">STUDENT ID</th>
                    <th className="py-3.5 px-4 font-extrabold">PASSWORD</th>
                    <th className="py-3.5 px-4 font-extrabold">CONTACT NO.</th>
                    <th className="py-3.5 px-4 font-extrabold">COURSE</th>
                    <th className="py-3.5 px-4 font-extrabold text-center">
                      FEES (PAID / UNPAID)
                    </th>
                    <th className="py-3.5 px-4 font-extrabold">MONTH</th>
                    <th className="py-3.5 px-4 text-right font-extrabold">
                      EDIT / ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentsPage.items.map((st) => {
                    const isPaid =
                      (st.fee_status || st.current_month_status) === "PAID";
                    const isToggling = togglingRowId === st.id;
                    const pwd = st.password || st.initial_passcode;
                    return (
                      <tr key={st.id} className="hover:bg-blue-50/40">
                        {/* 1. NAME */}
                        <td className="py-3 px-4 font-extrabold text-slate-900">
                          {st.name}
                        </td>

                        {/* 2. STUDENT ID */}
                        <td className="py-3 px-4">
                          {st.student_id ? (
                            <span className="font-mono font-extrabold text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-lg">
                              {st.student_id}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEditModal(st)}
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1 text-[11px] font-extrabold cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Student ID</span>
                            </button>
                          )}
                        </td>

                        {/* 3. PASSWORD */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(pwd);
                              toast({
                                type: "success",
                                title: "Password Copied",
                                description: `${st.student_id || st.name}: ${pwd}`,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 font-mono font-bold text-slate-800 cursor-pointer"
                          >
                            <span>{pwd}</span>
                            <Copy className="h-3 w-3 text-slate-500" />
                          </button>
                        </td>

                        {/* 4. CONTACT NO. */}
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {st.contact_number &&
                          st.contact_number !== "0000000000" ? (
                            st.contact_number
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 5. COURSE */}
                        <td className="py-3 px-4">
                          <span className="inline-block rounded-lg bg-blue-50 text-[#1E3A8A] px-2.5 py-1 text-[11px] font-extrabold">
                            {st.course || st.batch}
                          </span>
                        </td>

                        {/* 6. FEES (PAID / UNPAID) */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              disabled={isToggling}
                              onClick={() => handleToggleFeeStatus(st)}
                              title="Click to toggle PAID / UNPAID"
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold transition-all cursor-pointer ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                              }`}
                            >
                              {isToggling ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isPaid ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              <span>
                                {isPaid ? "PAID" : "UNPAID"} • ₹
                                {Number(st.monthly_fee).toFixed(0)}
                              </span>
                            </button>
                          </div>
                        </td>

                        {/* 7. MONTH */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 px-2.5 py-1 text-[11px] font-extrabold">
                            {st.month_label || activeMonthLabel}
                          </span>
                        </td>

                        {/* 8. EDIT / ACTIONS */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(st)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] text-white px-2.5 py-1.5 text-[11px] font-extrabold cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>

                            {!isPaid && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendSingleReminder(st, "WHATSAPP")
                                  }
                                  disabled={
                                    sendingRowId === `${st.id}-WHATSAPP`
                                  }
                                  title="Send WhatsApp Reminder"
                                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 transition-colors cursor-pointer"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSendSingleReminder(st, "SMS")
                                  }
                                  disabled={sendingRowId === `${st.id}-SMS`}
                                  title="Send SMS Reminder"
                                  className="rounded-lg bg-slate-700 hover:bg-slate-900 text-white p-1.5 transition-colors cursor-pointer"
                                >
                                  <Smartphone className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            <a
                              href={`/api/backend/v1/students/${encodeURIComponent(
                                st.student_id || st.id
                              )}/id-card.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              title="Download Student ID Card PDF"
                              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[#1E3A8A] p-1.5 transition-colors"
                            >
                              <IdCard className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600">
              <span>
                Showing{" "}
                <strong>
                  {(studentsPage.meta.page - 1) * studentsPage.meta.page_size +
                    1}
                </strong>{" "}
                to{" "}
                <strong>
                  {Math.min(
                    studentsPage.meta.page * studentsPage.meta.page_size,
                    studentsPage.meta.total
                  )}
                </strong>{" "}
                of <strong>{studentsPage.meta.total}</strong> students
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 px-3 py-1.5 font-bold cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                <span className="font-bold text-slate-800 px-2">
                  Page {page} of {studentsPage.meta.total_pages}
                </span>
                <button
                  type="button"
                  disabled={page >= studentsPage.meta.total_pages}
                  onClick={() =>
                    setPage((p) =>
                      Math.min(studentsPage.meta.total_pages, p + 1)
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 px-3 py-1.5 font-bold cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
