"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
  Download,
  Trash2,
  Camera,
  Power,
  UserCheck,
  UserX,
  Wallet,
  FileCheck2,
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
  year?: number;
  selected_batch: string;
  total_students: number;
  active_students: number;
  inactive_students: number;
  assigned_id_count?: number;
  missing_id_count?: number;
  paid_students_count: number;
  unpaid_students_count: number;
  pending_admissions_count?: number;
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
  parent_name?: string;
  dob?: string;
  contact_number: string;
  address?: string;
  course: string;
  batch: string;
  admission_date?: string;
  monthly_fee: number;
  fee_status: "PAID" | "UNPAID";
  current_month_status: "PAID" | "UNPAID";
  month: string;
  current_month: string;
  month_label: string;
  photo_url?: string | null;
  active: boolean;
  status: "ACTIVE" | "INACTIVE";
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

interface SystemSettingsFlags {
  online_admissions_enabled: boolean;
  online_fee_payment_enabled: boolean;
  student_id_download_enabled: boolean;
  photo_albums_visible_to_students: boolean;
  fee_reminders_enabled: boolean;
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

export default function AdminDashboardPage() {
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonthNum, setSelectedMonthNum] = useState<string>("06");
  const activeMonth = `${selectedYear}-${selectedMonthNum}`;

  const [selectedCourse, setSelectedCourse] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("ALL");
  const [idFilter, setIdFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [sendingRowId, setSendingRowId] = useState<string | null>(null);
  const [togglingRowId, setTogglingRowId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);

  // Add Student Modal/Form state (Complete Section 4 fields)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newParentName, setNewParentName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCourse, setNewCourse] = useState("CERT");
  const [newAdmissionDate, setNewAdmissionDate] = useState("2026-06-01");
  const [newFee, setNewFee] = useState("600");
  const [newFeeStatus, setNewFeeStatus] = useState<"UNPAID" | "PAID">("UNPAID");
  const [newActive, setNewActive] = useState<boolean>(true);
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string | null>(null);

  // Edit Student Modal state
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStudentId, setEditStudentId] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editParentName, setEditParentName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editAdmissionDate, setEditAdmissionDate] = useState("2027-01-01");
  const [editFee, setEditFee] = useState("");
  const [editFeeStatus, setEditFeeStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  const [editActive, setEditActive] = useState<boolean>(true);
  const [editPhotoDataUrl, setEditPhotoDataUrl] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 1. Master Analytics Query
  const { data: analytics, isLoading: loadingAnalytics } =
    useQuery<DashboardAnalytics>({
      queryKey: [
        "admin",
        "dashboard",
        activeMonth,
        selectedCourse,
        activeStatusFilter,
      ],
      queryFn: () =>
        api.get<DashboardAnalytics>("/v1/admin/dashboard", {
          month: activeMonth,
          ...(selectedCourse !== "ALL" ? { course: selectedCourse } : {}),
          ...(activeStatusFilter !== "ALL"
            ? { active_status: activeStatusFilter }
            : {}),
        }),
    });

  // 2. Student Records Query
  const { data: studentsPage, isLoading: loadingStudents } =
    useQuery<PaginatedStudents>({
      queryKey: [
        "admin",
        "students-table",
        activeMonth,
        selectedCourse,
        statusFilter,
        activeStatusFilter,
        idFilter,
        search,
        page,
      ],
      queryFn: () =>
        api.get<PaginatedStudents>("/v1/admin/students", {
          month: activeMonth,
          course: selectedCourse !== "ALL" ? selectedCourse : undefined,
          fee_status: statusFilter !== "ALL" ? statusFilter : undefined,
          active_status:
            activeStatusFilter !== "ALL" ? activeStatusFilter : undefined,
          id_status: idFilter !== "ALL" ? idFilter : undefined,
          search: search.trim() || undefined,
          page,
          page_size: 50,
        }),
    });

  // 3. System ON/OFF Settings Query (Section 12)
  const { data: sysSettings } = useQuery<SystemSettingsFlags>({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<SystemSettingsFlags>("/v1/admin/settings"),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  const handleToggleSystemFlag = async (
    key: keyof SystemSettingsFlags,
    currentVal: boolean
  ) => {
    try {
      await api.put("/v1/admin/settings", { [key]: !currentVal });
      toast({
        type: "success",
        title: `Turned ${!currentVal ? "ON" : "OFF"}`,
        description: `Updated ${key.replace(/_/g, " ")}.`,
      });
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Setting Update Failed",
        description:
          err instanceof Error ? err.message : "Could not toggle setting.",
      });
    }
  };

  const handlePhotoFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({
        type: "error",
        title: "File Too Large",
        description: "Photograph must be 2 MB or smaller.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const openEditModal = (st: StudentRow) => {
    setEditingStudent(st);
    setEditName(st.name);
    setEditStudentId(st.student_id || "");
    setEditPassword(st.password || st.initial_passcode || "");
    setEditParentName(st.parent_name || "");
    setEditDob(st.dob || "");
    setEditContact(st.contact_number || "");
    setEditAddress(st.address || "");
    setEditCourse(st.course || st.batch || "GENERAL");
    setEditAdmissionDate(st.admission_date || "2027-01-01");
    setEditFee(String(st.monthly_fee ?? 600));
    setEditFeeStatus(st.fee_status || st.current_month_status || "UNPAID");
    setEditActive(st.active !== false);
    setEditPhotoDataUrl(null);
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
        parent_name: editParentName.trim(),
        dob: editDob,
        contact_number: editContact.trim(),
        address: editAddress.trim(),
        course: editCourse.trim().toUpperCase(),
        admission_date: editAdmissionDate,
        monthly_fee: Number(editFee) || 600,
        fee_status: editFeeStatus,
        month: activeMonth,
        active: editActive,
        status: editActive ? "ACTIVE" : "INACTIVE",
        ...(editPhotoDataUrl ? { photo_data_url: editPhotoDataUrl } : {}),
      });
      toast({
        type: "success",
        title: "Student Record Updated",
        description: `Saved ${editName} (${editStudentId || "Unassigned ID"}).`,
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
        parent_name: newParentName.trim(),
        dob: newDob,
        contact_number: newContact.trim(),
        address: newAddress.trim(),
        course: newCourse.trim().toUpperCase() || "GENERAL",
        admission_date: newAdmissionDate,
        monthly_fee: Number(newFee) || 600,
        fee_status: newFeeStatus,
        month: activeMonth,
        active: newActive,
        status: newActive ? "ACTIVE" : "INACTIVE",
        ...(newPhotoDataUrl ? { photo_data_url: newPhotoDataUrl } : {}),
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
      setNewParentName("");
      setNewDob("");
      setNewContact("");
      setNewAddress("");
      setNewPhotoDataUrl(null);
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

  const handleDeleteStudent = async (st: StudentRow) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${st.name} (${st.student_id || "No ID"})?`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/v1/admin/students/${st.id}`);
      toast({
        type: "success",
        title: "Student Deleted",
        description: `Removed ${st.name} from the database.`,
      });
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Delete Failed",
        description:
          err instanceof Error ? err.message : "Could not delete student.",
      });
    }
  };

  // Toggle Active / Inactive Student Status (Section 11)
  const handleToggleStudentActive = async (st: StudentRow) => {
    setTogglingActiveId(st.id);
    const nextActive = !(st.active !== false);
    try {
      await api.put(`/v1/admin/students/${st.id}`, {
        active: nextActive,
        status: nextActive ? "ACTIVE" : "INACTIVE",
      });
      toast({
        type: "success",
        title: `Student Marked as ${nextActive ? "ACTIVE" : "INACTIVE"}`,
        description: `${st.name} (${st.student_id || "No ID"}) status updated.`,
      });
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Status Update Failed",
        description:
          err instanceof Error ? err.message : "Could not change status.",
      });
    } finally {
      setTogglingActiveId(null);
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
        payment_mode: "CASH",
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

  // Excel (.xlsx) & CSV Upload Handler
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dry_run", "false");

      const res = await fetch("/api/backend/v1/imports/excel", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || "Excel/CSV import failed.");
      }

      const d = json.data;
      toast({
        type: "success",
        title: `Excel/CSV Imported (${d.format || "File"})`,
        description: `Processed ${d.total_rows} rows (${d.inserted_rows} inserted, ${d.updated_rows} updated, ${d.duplicate_rows || 0} duplicates).`,
      });
      refreshAll();
    } catch (err) {
      toast({
        type: "error",
        title: "Import Error",
        description:
          err instanceof Error ? err.message : "Could not parse Excel/CSV file.",
      });
    } finally {
      setIsUploadingExcel(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
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

  const monthObj = MONTHS_LIST.find((m) => m.num === selectedMonthNum);
  const activeMonthLabel =
    analytics?.active_month_label ||
    `${monthObj?.name || "December"} ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* Top Action Header: Year & 12-Month Selector + Add Student + Excel Import/Export */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] via-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider">
                Super Admin Control Center • {activeMonthLabel}
              </span>
              {analytics?.pending_admissions_count ? (
                <Link
                  href="/admin/admissions"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-400 text-slate-950 px-3 py-0.5 text-xs font-extrabold hover:bg-emerald-300"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>
                    {analytics.pending_admissions_count} New Online Admission
                    Requests
                  </span>
                </Link>
              ) : null}
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold">
              BRIGHTWAY COMPUTER EDUCATION — Management System
            </h2>
            <p className="text-xs text-blue-100 mt-1">
              Complete Student Management, 12-Month Fee Ledger, Excel (.xlsx) Import/Export, Active/Inactive Student Control, and Password-Protected Cash Flow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
              <Calendar className="h-4 w-4 text-[#FBBF24]" />
              <span className="text-xs font-bold text-[#FBBF24]">Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-extrabold text-white focus:outline-hidden cursor-pointer"
              >
                <option value="2023" className="text-slate-900">
                  2023
                </option>
                <option value="2024" className="text-slate-900">
                  2024
                </option>
                <option value="2025" className="text-slate-900">
                  2025
                </option>
                <option value="2026" className="text-slate-900">
                  2026
                </option>
                <option value="2027" className="text-slate-900">
                  2027
                </option>
              </select>
            </div>

            {/* All 12 Months Selector */}
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

            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#1E3A8A] hover:bg-blue-50 px-4 py-2.5 text-xs font-extrabold shadow-md transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{showAddForm ? "Close Form" : "Add New Student"}</span>
            </button>

            {/* Upload Excel / CSV Button */}
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              disabled={isUploadingExcel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 px-4 py-2.5 text-xs font-extrabold shadow-md transition-colors cursor-pointer"
            >
              {isUploadingExcel ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>
                {isUploadingExcel ? "Uploading..." : "Upload Excel (.xlsx/.csv)"}
              </span>
            </button>

            <a
              href={`/api/backend/v1/admin/export/students?format=xlsx&active_status=${activeStatusFilter}&course=${selectedCourse}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 text-xs font-extrabold shadow-md transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download Excel (.xlsx)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Section 12: Quick ON/OFF Controls & Section 7: Cash Flow Quick Access */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E3A8A]">
            <Power className="h-4 w-4 text-[#F59E0B]" />
            <span>Super Admin ON/OFF Controls:</span>
          </span>

          {(
            [
              {
                key: "online_admissions_enabled",
                label: "Online Admission Form",
              },
              {
                key: "online_fee_payment_enabled",
                label: "Online Fee Payment",
              },
              {
                key: "photo_albums_visible_to_students",
                label: "Student Photo Albums",
              },
              {
                key: "fee_reminders_enabled",
                label: "Due Fee Reminders",
              },
            ] as const
          ).map((flag) => {
            const isOn = sysSettings ? sysSettings[flag.key] !== false : true;
            return (
              <button
                key={flag.key}
                type="button"
                onClick={() => handleToggleSystemFlag(flag.key, isOn)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold border transition-all cursor-pointer ${
                  isOn
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                    : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOn ? "bg-emerald-600" : "bg-slate-400"
                  }`}
                />
                <span>{flag.label}:</span>
                <span className={isOn ? "text-emerald-900" : "text-red-600"}>
                  {isOn ? "ON" : "OFF"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/fees"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] px-3.5 py-2 text-xs font-extrabold transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>12-Month Fee Matrix</span>
          </Link>
          <Link
            href="/admin/cash-flow"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-[#FBBF24] px-3.5 py-2 text-xs font-extrabold transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>Cash Flow Management (🔒)</span>
          </Link>
        </div>
      </div>

      {/* Section 10: 7 Dashboard Statistics Cards */}
      {loadingAnalytics || !analytics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
          {/* 1. Total Students */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Total Students
              </span>
              <Users className="h-4 w-4 text-[#1E3A8A]" />
            </div>
            <p className="mt-2 text-2xl font-black text-[#1E3A8A]">
              {analytics.total_students.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {analytics.assigned_id_count ?? 0} with ID
            </p>
          </div>

          {/* 2. Active Students */}
          <button
            type="button"
            onClick={() => {
              setActiveStatusFilter(
                activeStatusFilter === "ACTIVE" ? "ALL" : "ACTIVE"
              );
              setPage(1);
            }}
            className={`text-left rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
              activeStatusFilter === "ACTIVE"
                ? "border-2 border-emerald-600 bg-emerald-50/40"
                : "border-emerald-200 bg-white hover:bg-emerald-50/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-emerald-700">
                Active Students
              </span>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-700">
              {(analytics.active_students ?? analytics.total_students).toLocaleString(
                "en-IN"
              )}
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 font-semibold">
              Click to filter Active
            </p>
          </button>

          {/* 3. Inactive Students */}
          <button
            type="button"
            onClick={() => {
              setActiveStatusFilter(
                activeStatusFilter === "INACTIVE" ? "ALL" : "INACTIVE"
              );
              setPage(1);
            }}
            className={`text-left rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
              activeStatusFilter === "INACTIVE"
                ? "border-2 border-rose-600 bg-rose-50/40"
                : "border-slate-200 bg-white hover:bg-rose-50/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                Inactive Students
              </span>
              <UserX className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-black text-rose-600">
              {(analytics.inactive_students ?? 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 font-semibold">
              Click to filter Inactive
            </p>
          </button>

          {/* 4. Total Paid Students */}
          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-emerald-700">
                Total Paid ({selectedMonthNum}/{selectedYear.slice(2)})
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-700">
              {analytics.paid_students_count.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Paid for {activeMonthLabel}
            </p>
          </div>

          {/* 5. Total Unpaid Students */}
          <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-amber-800">
                Total Unpaid
              </span>
              <AlertCircle className="h-4 w-4 text-[#F59E0B]" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-700">
              {analytics.unpaid_students_count.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Due for {activeMonthLabel}
            </p>
          </div>

          {/* 6. Monthly Fee Collection */}
          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-emerald-700">
                Monthly Collection
              </span>
              <IndianRupee className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-700">
              ₹{analytics.monthly_revenue_collected.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{activeMonthLabel}</p>
          </div>

          {/* 7. Pending Fee Collection */}
          <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-amber-800">
                Pending Collection
              </span>
              <IndianRupee className="h-4 w-4 text-amber-700" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-700">
              ₹{analytics.monthly_pending_dues.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{activeMonthLabel}</p>
          </div>
        </div>
      )}

      {/* Add New Student Form (All Section 4 Fields + Photo Capture/Upload) */}
      {showAddForm && (
        <form
          onSubmit={handleCreateStudent}
          className="rounded-2xl border-2 border-[#2563EB]/30 bg-blue-50/50 p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
            <h3 className="text-sm font-extrabold text-[#1E3A8A] uppercase tracking-wider">
              Add New Student Record (Complete Profile &amp; Photograph)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Student Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Student ID
              </label>
              <input
                type="text"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value.toUpperCase())}
                placeholder="e.g. RG240099"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Father&apos;s / Mother&apos;s Name
              </label>
              <input
                type="text"
                value={newParentName}
                onChange={(e) => setNewParentName(e.target.value)}
                placeholder="Parent / Guardian Name"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Residential Address
              </label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Complete Address"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Category (CERT / NON-CERT)
              </label>
              <select
                value={newCourse}
                onChange={(e) => setNewCourse(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-[#1E3A8A]"
              >
                <option value="CERT">CERT (Certificate Course)</option>
                <option value="NON-CERT">NON-CERT (Non-Certificate Course)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Admission Date
              </label>
              <input
                type="date"
                value={newAdmissionDate}
                onChange={(e) => setNewAdmissionDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Monthly Fee (₹) &amp; Status
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
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Portal Password &amp; Active Status
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Auto Password"
                  className="w-1/2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono"
                />
                <select
                  value={newActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) => setNewActive(e.target.value === "ACTIVE")}
                  className="w-1/2 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-extrabold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Student Photograph
              </label>
              <input
                ref={addPhotoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                capture="user"
                onChange={(e) => handlePhotoFileSelect(e, setNewPhotoDataUrl)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => addPhotoInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2563EB] bg-white hover:bg-blue-50 text-[#1E3A8A] py-2 px-3 text-xs font-extrabold cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-[#2563EB]" />
                <span>
                  {newPhotoDataUrl ? "Photo Selected ✓" : "Upload / Capture Photo"}
                </span>
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-[#1E3A8A] hover:bg-slate-900 text-white py-2.5 px-4 text-xs font-extrabold cursor-pointer"
              >
                Save New Student
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Student Modal (Complete Section 4 Fields + Photo Update) */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#2563EB]">
                  Edit Student Profile &amp; Credentials
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Name *
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
                  Student ID (Add or Edit)
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
                  Father&apos;s / Mother&apos;s Name
                </label>
                <input
                  type="text"
                  value={editParentName}
                  onChange={(e) => setEditParentName(e.target.value)}
                  placeholder="Parent's Name"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  placeholder="10-digit contact number"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Student residential address"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category (CERT / NON-CERT)
                </label>
                <select
                  value={editCourse.includes("NON") ? "NON-CERT" : "CERT"}
                  onChange={(e) => setEditCourse(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-extrabold text-[#1E3A8A]"
                >
                  <option value="CERT">CERT (Certificate Course)</option>
                  <option value="NON-CERT">NON-CERT (Non-Certificate Course)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admission Date
                </label>
                <input
                  type="date"
                  value={editAdmissionDate}
                  onChange={(e) => setEditAdmissionDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monthly Fee (₹)
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
                  Portal Password
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fee Status ({activeMonthLabel})
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
                  Active / Inactive Status
                </label>
                <select
                  value={editActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(e) => setEditActive(e.target.value === "ACTIVE")}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-extrabold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Update Student Photograph (PNG/JPEG, Max 2 MB)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={editPhotoInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    capture="user"
                    onChange={(e) =>
                      handlePhotoFileSelect(e, setEditPhotoDataUrl)
                    }
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editPhotoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#2563EB] bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] px-4 py-2 text-xs font-extrabold cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5 text-[#2563EB]" />
                    <span>
                      {editPhotoDataUrl
                        ? "New Photograph Ready ✓"
                        : "Upload / Replace Photograph"}
                    </span>
                  </button>
                  {editPhotoDataUrl && (
                    <img
                      src={editPhotoDataUrl}
                      alt="Preview"
                      className="h-10 w-10 rounded-lg object-cover border border-blue-300"
                    />
                  )}
                </div>
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

      {/* Quick Filters by Category: CERT & NON-CERT Only */}
      {analytics && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#1E3A8A]">
              <Filter className="h-3.5 w-3.5 text-[#F59E0B]" />
              Filter by Student Category (CERT vs NON-CERT Only)
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
                Show All Students
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCourse("ALL");
                setPage(1);
              }}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                selectedCourse === "ALL"
                  ? "bg-[#1E3A8A] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Students ({analytics.total_students})
            </button>

            {(["CERT", "NON-CERT"] as const).map((cat) => {
              const active = selectedCourse === cat;
              const match = analytics.batches.find((b) => b.batch === cat);
              const count = match?.student_count ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCourse(cat);
                    setPage(1);
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                    active
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-[#1E3A8A]"
                  }`}
                >
                  <span>
                    {cat === "CERT"
                      ? "CERT (Certificate Students)"
                      : "NON-CERT (Non-Certificate Students)"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      active
                        ? "bg-[#FBBF24] text-slate-950"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Multi-Channel Due Fee Reminder Dispatcher Bar */}
      <div className="rounded-2xl border-2 border-[#F59E0B]/60 bg-amber-50/50 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#F59E0B] text-slate-950 px-2.5 py-0.5 text-[11px] font-extrabold uppercase">
              Due Fee Reminder Dispatcher
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

      {/* Main Student Database & Active Student Management Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-[#1E3A8A]">
              Student Database &amp; Active Student Management ({activeMonthLabel})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage Student ID, Password, Parent Name, Contact, Course, Active/Inactive Status, and {activeMonthLabel} Fees.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search Name, Student ID, Phone..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
              />
            </div>

            {/* Section 11: Dedicated Active / Inactive Student Filter Button */}
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              {(
                [
                  { key: "ALL", label: "All Status" },
                  { key: "ACTIVE", label: "Active Only" },
                  { key: "INACTIVE", label: "Inactive" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveStatusFilter(item.key);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer ${
                    activeStatusFilter === item.key
                      ? "bg-emerald-700 text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
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
                    <th className="py-3.5 px-3.5 font-extrabold">NAME</th>
                    <th className="py-3.5 px-3.5 font-extrabold">STUDENT ID</th>
                    <th className="py-3.5 px-3.5 font-extrabold">PASSWORD</th>
                    <th className="py-3.5 px-3.5 font-extrabold">CONTACT NO.</th>
                    <th className="py-3.5 px-3.5 font-extrabold">COURSE</th>
                    <th className="py-3.5 px-3.5 font-extrabold text-center">
                      FEES (PAID / UNPAID)
                    </th>
                    <th className="py-3.5 px-3.5 font-extrabold">MONTH</th>
                    <th className="py-3.5 px-3.5 font-extrabold text-center">
                      ACTIVE STATUS
                    </th>
                    <th className="py-3.5 px-3.5 text-right font-extrabold">
                      EDIT / ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentsPage.items.map((st) => {
                    const isPaid =
                      (st.fee_status || st.current_month_status) === "PAID";
                    const isToggling = togglingRowId === st.id;
                    const isTogglingAct = togglingActiveId === st.id;
                    const isActiveStudent = st.active !== false;
                    const pwd = st.password || st.initial_passcode;
                    return (
                      <tr
                        key={st.id}
                        className={`hover:bg-blue-50/40 ${
                          !isActiveStudent ? "bg-slate-50/80 opacity-75" : ""
                        }`}
                      >
                        {/* 1. NAME */}
                        <td className="py-3 px-3.5">
                          <p className="font-extrabold text-slate-900">
                            {st.name}
                          </p>
                          {st.parent_name && (
                            <p className="text-[10px] text-slate-500">
                              Guardian: {st.parent_name}
                            </p>
                          )}
                        </td>

                        {/* 2. STUDENT ID */}
                        <td className="py-3 px-3.5">
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
                        <td className="py-3 px-3.5">
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
                        <td className="py-3 px-3.5 font-mono text-slate-700">
                          {st.contact_number &&
                          st.contact_number !== "0000000000" ? (
                            st.contact_number
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 5. COURSE */}
                        <td className="py-3 px-3.5">
                          <span className="inline-block rounded-lg bg-blue-50 text-[#1E3A8A] px-2.5 py-1 text-[11px] font-extrabold">
                            {st.course || st.batch}
                          </span>
                        </td>

                        {/* 6. FEES (PAID / UNPAID) */}
                        <td className="py-3 px-3.5 text-center">
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
                        </td>

                        {/* 7. MONTH */}
                        <td className="py-3 px-3.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 px-2.5 py-1 text-[11px] font-extrabold">
                            {st.month_label || activeMonthLabel}
                          </span>
                        </td>

                        {/* 8. ACTIVE / INACTIVE STATUS TOGGLE */}
                        <td className="py-3 px-3.5 text-center">
                          <button
                            type="button"
                            disabled={isTogglingAct}
                            onClick={() => handleToggleStudentActive(st)}
                            title="Click to toggle Active / Inactive status"
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold cursor-pointer ${
                              isActiveStudent
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isActiveStudent
                                  ? "bg-emerald-600"
                                  : "bg-slate-500"
                              }`}
                            />
                            <span>
                              {isActiveStudent ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </button>
                        </td>

                        {/* 9. EDIT / ACTIONS */}
                        <td className="py-3 px-3.5 text-right">
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

                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(st)}
                              title="Delete Student"
                              className="rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 p-1.5 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
