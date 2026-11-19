"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Power,
  Lock,
  Database,
  Activity,
  Loader2,
  CheckCircle2,
  Download,
  Users,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";

interface AdminUserItem {
  id: string;
  username: string;
  display_name: string;
  role: "SUPER_ADMIN" | "ADMIN";
  active: boolean;
  created_at?: string;
}

interface SystemSettingsData {
  online_admissions_enabled: boolean;
  online_fee_payment_enabled: boolean;
  student_id_download_enabled: boolean;
  photo_albums_visible_to_students: boolean;
  fee_reminders_enabled: boolean;
  institute_address?: string;
  institute_phone?: string;
  updated_by?: string;
  updated_at?: string;
}

interface ActivityLogItem {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  details: string;
  created_at: string;
}

export default function SuperAdminSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // New Admin Form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // Cash flow password update
  const [cashflowPassword, setCashflowPassword] = useState("");
  const [isUpdatingCashPwd, setIsUpdatingCashPwd] = useState(false);

  const { data: adminsData, isLoading: adminsLoading } = useQuery<
    AdminUserItem[] | { items: AdminUserItem[] }
  >({
    queryKey: ["admin", "users"],
    queryFn: () =>
      api.get<AdminUserItem[] | { items: AdminUserItem[] }>("/v1/admin/admins"),
  });

  const { data: settings } = useQuery<SystemSettingsData>({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<SystemSettingsData>("/v1/admin/settings"),
  });

  const { data: logsData } = useQuery<
    ActivityLogItem[] | { items: ActivityLogItem[] }
  >({
    queryKey: ["admin", "activity-logs"],
    queryFn: () =>
      api.get<ActivityLogItem[] | { items: ActivityLogItem[] }>(
        "/v1/admin/activity-logs?limit=60"
      ),
  });

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || password.length < 6) {
      toast({
        type: "error",
        title: "Invalid Input",
        description: "Username and a password of at least 6 characters are required.",
      });
      return;
    }
    setIsCreatingAdmin(true);
    try {
      await api.post("/v1/admin/users", {
        username: username.trim().toUpperCase(),
        password,
        display_name: displayName.trim() || username.trim().toUpperCase(),
        role,
      });
      setUsername("");
      setPassword("");
      setDisplayName("");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "activity-logs"] });
      toast({
        type: "success",
        title: "Admin Account Created",
        description: `Created ${role} account ${username.toUpperCase()}.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to Create Admin",
        description:
          err instanceof Error ? err.message : "Could not create admin account.",
      });
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (targetUsername: string) => {
    if (!window.confirm(`Remove admin account ${targetUsername}?`)) return;
    try {
      await api.delete(`/v1/admin/users/${encodeURIComponent(targetUsername)}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "activity-logs"] });
      toast({
        type: "success",
        title: "Admin Account Deleted",
        description: `${targetUsername} removed.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Delete Failed",
        description:
          err instanceof Error ? err.message : "Could not delete admin.",
      });
    }
  };

  const handleToggleSetting = async (
    key: keyof SystemSettingsData,
    currentVal: boolean
  ) => {
    try {
      await api.patch("/v1/admin/settings", {
        [key]: !currentVal,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "activity-logs"] });
      toast({
        type: "success",
        title: "ON/OFF Setting Updated",
        description: `${String(key).replace(/_/g, " ")} is now ${
          !currentVal ? "ON" : "OFF"
        }.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Update Failed",
        description:
          err instanceof Error ? err.message : "Could not toggle setting.",
      });
    }
  };

  const handleUpdateCashflowPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cashflowPassword.length < 6) return;
    setIsUpdatingCashPwd(true);
    try {
      await api.patch("/v1/admin/settings", {
        cashflow_password: cashflowPassword,
      });
      setCashflowPassword("");
      queryClient.invalidateQueries({ queryKey: ["admin", "activity-logs"] });
      toast({
        type: "success",
        title: "Cash Flow Password Updated",
        description:
          "Secondary password for Cash Flow Management has been updated.",
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Password Update Failed",
        description:
          err instanceof Error ? err.message : "Could not update password.",
      });
    } finally {
      setIsUpdatingCashPwd(false);
    }
  };

  const admins = Array.isArray(adminsData)
    ? adminsData
    : adminsData?.items || [];
  const logs = Array.isArray(logsData) ? logsData : logsData?.items || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] via-[#1E3A8A] to-[#2563EB] p-6 sm:p-8 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-[#FBBF24]/40 px-3 py-1 text-xs font-bold text-[#FBBF24]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Super Admin Governance, RBAC &amp; Backups
          </span>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold">
            Admins, System ON/OFF Controls &amp; Security Logs
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Manage Super Admin &amp; Restricted Admin accounts, feature ON/OFF switches, Cash Flow lock password, and database backups.
          </p>
        </div>

        <a
          href="/api/backend/v1/admin/backup"
          className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 px-5 py-3 text-xs font-extrabold shadow-md transition-colors"
        >
          <Database className="h-4 w-4" />
          <Download className="h-4 w-4" />
          <span>Download Complete JSON Database Backup</span>
        </a>
      </div>

      {/* System ON/OFF Controls + Cash Flow Password */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Power className="h-5 w-5 text-[#1E3A8A]" />
            <div>
              <h2 className="font-display text-base font-extrabold text-[#1E3A8A]">
                System Feature ON / OFF Switches
              </h2>
              <p className="text-xs text-slate-500">
                Super Admin controls for public and student-facing institute modules
              </p>
            </div>
          </div>

          {settings && (
            <div className="space-y-3">
              {[
                {
                  key: "online_admissions_enabled" as const,
                  title: "Online Admission Form",
                  desc: "Allow prospective students to submit online admission requests at /admissions",
                },
                {
                  key: "online_fee_payment_enabled" as const,
                  title: "Razorpay Online Fee Payment",
                  desc: "Enable online UPI, Card & Net Banking payments in Student Portal",
                },
                {
                  key: "student_id_download_enabled" as const,
                  title: "Student Digital ID Card Download",
                  desc: "Allow students to download PDF & PNG digital ID cards",
                },
                {
                  key: "photo_albums_visible_to_students" as const,
                  title: "Student Photo Albums Visibility",
                  desc: "Allow logged-in students to view permitted Year-Wise Photo Albums",
                },
                {
                  key: "fee_reminders_enabled" as const,
                  title: "Monthly Fee Reminders",
                  desc: "Display automated monthly due reminders on unpaid student dashboards",
                },
              ].map((item) => {
                const isOn = Boolean(settings[item.key]);
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3.5"
                  >
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSetting(item.key, isOn)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                        isOn
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isOn ? "bg-white" : "bg-slate-500"
                        }`}
                      />
                      <span>{isOn ? "ON" : "OFF"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin Account Creator */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <UserPlus className="h-5 w-5 text-[#2563EB]" />
              <div>
                <h2 className="font-display text-base font-extrabold text-[#1E3A8A]">
                  Create or Update Admin Account
                </h2>
                <p className="text-xs text-slate-500">
                  <strong>ADMIN</strong> can access only Monthly Fee Management.{" "}
                  <strong>SUPER_ADMIN</strong> has full institute access.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    placeholder="e.g. FEESADMIN2"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Fees Desk Officer"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Password *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Access Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "ADMIN" | "SUPER_ADMIN")
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-[#1E3A8A]"
                  >
                    <option value="ADMIN">
                      ADMIN (Restricted — Fees Management Only)
                    </option>
                    <option value="SUPER_ADMIN">
                      SUPER_ADMIN (Full System &amp; Cash Flow Access)
                    </option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreatingAdmin}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white px-5 py-2.5 text-xs font-extrabold shadow-xs cursor-pointer"
              >
                {isCreatingAdmin ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 text-[#FBBF24]" />
                )}
                <span>Save Admin Account</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Existing Admins Directory */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-[#1E3A8A]" />
          <h2 className="font-display text-base font-extrabold text-[#1E3A8A]">
            Authorized Administrator Accounts ({admins.length})
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1E3A8A] text-white uppercase">
              <tr>
                <th className="py-3 px-4 font-extrabold">Username</th>
                <th className="py-3 px-4 font-extrabold">Display Name</th>
                <th className="py-3 px-4 font-extrabold">Access Level</th>
                <th className="py-3 px-4 font-extrabold">Permissions Summary</th>
                <th className="py-3 px-4 font-extrabold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {adminsLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    Loading administrators...
                  </td>
                </tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.username} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-extrabold text-[#1E3A8A]">
                      {a.username}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {a.display_name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-0.5 text-[11px] font-extrabold ${
                          a.role === "SUPER_ADMIN"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-blue-100 text-[#1E3A8A]"
                        }`}
                      >
                        {a.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {a.role === "SUPER_ADMIN"
                        ? "Full access: Students, Fees, Cash Flow, Admissions, ID Cards, Albums, Excel & Settings"
                        : "Restricted: Monthly Fee Management & Payment Status Only (No Cash Flow or Settings)"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {a.username !== "BWADMIN" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmin(a.username)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1 text-xs font-bold cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Audit Logs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-[#2563EB]" />
          <div>
            <h2 className="font-display text-base font-extrabold text-[#1E3A8A]">
              Administrative Activity Audit Log
            </h2>
            <p className="text-xs text-slate-500">
              Permanent audit trail of Super Admin &amp; Admin actions across fees, students, expenses, and settings
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0">
              <tr>
                <th className="py-2.5 px-4 font-extrabold">Timestamp</th>
                <th className="py-2.5 px-4 font-extrabold">Actor</th>
                <th className="py-2.5 px-4 font-extrabold">Role</th>
                <th className="py-2.5 px-4 font-extrabold">Action</th>
                <th className="py-2.5 px-4 font-extrabold">Target</th>
                <th className="py-2.5 px-4 font-extrabold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                      {log.created_at?.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-[#1E3A8A]">
                      {log.actor}
                    </td>
                    <td className="py-2.5 px-4 font-bold">{log.role}</td>
                    <td className="py-2.5 px-4">
                      <span className="rounded-md bg-blue-50 text-[#2563EB] px-2 py-0.5 font-mono font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold">
                      {log.target}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
