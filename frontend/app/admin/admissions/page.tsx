"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/toast";
import { CardSkeleton } from "@/components/ui/skeleton";

interface OnlineAdmissionItem {
  id: string;
  application_number: string;
  student_name: string;
  parent_name: string;
  dob: string;
  contact_number: string;
  address: string;
  course: string;
  admission_date: string;
  photo_url?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  assigned_student_id?: string | null;
  created_at: string;
}

export default function AdminAdmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [approvingItem, setApprovingItem] =
    useState<OnlineAdmissionItem | null>(null);
  const [assignId, setAssignId] = useState("");
  const [assignFee, setAssignFee] = useState("600");
  const [isProcessing, setIsProcessing] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: admissions, isLoading } = useQuery<OnlineAdmissionItem[]>({
    queryKey: ["admin", "admissions", statusFilter],
    queryFn: () =>
      api.get<OnlineAdmissionItem[]>("/v1/admin/admissions", {
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      }),
  });

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingItem) return;
    setIsProcessing(true);
    try {
      const res = await api.post<{
        student_id: string;
        password: string;
      }>(`/v1/admin/admissions/${approvingItem.id}/approve`, {
        student_id: assignId.trim() || undefined,
        monthly_fee: Number(assignFee) || 600,
      });
      toast({
        type: "success",
        title: "Admission Approved & Student Enrolled",
        description: `Student ID: ${res.student_id} | Password: ${res.password}`,
      });
      setApprovingItem(null);
      setAssignId("");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Approval Failed",
        description:
          err instanceof Error ? err.message : "Could not approve admission.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (item: OnlineAdmissionItem) => {
    try {
      await api.post(`/v1/admin/admissions/${item.id}/reject`, {});
      toast({
        type: "success",
        title: "Application Rejected",
        description: `Rejected ${item.student_name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "admissions"] });
    } catch (err) {
      toast({
        type: "error",
        title: "Action Failed",
        description:
          err instanceof Error ? err.message : "Could not reject application.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3 py-0.5 text-xs font-extrabold uppercase">
            <FileCheck2 className="h-3.5 w-3.5" />
            Section 14 • Online Admission Verification
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold">
            Online Admission Applications
          </h1>
          <p className="text-xs text-blue-100 mt-1">
            Verify and approve online admission requests submitted from the public website to automatically create official student accounts.
          </p>
        </div>

        <div className="flex rounded-xl bg-white/10 p-1 border border-white/20">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold cursor-pointer ${
                statusFilter === st
                  ? "bg-[#F59E0B] text-slate-950"
                  : "text-white hover:bg-white/10"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Approve Modal */}
      {approvingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleApprove}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h3 className="text-lg font-extrabold text-[#1E3A8A]">
              Approve &amp; Enroll {approvingItem.student_name}
            </h3>
            <p className="text-xs text-slate-600">
              Course: <strong>{approvingItem.course}</strong> • Contact:{" "}
              <strong>{approvingItem.contact_number}</strong>
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assign Student ID (Leave blank to auto-generate)
              </label>
              <input
                type="text"
                value={assignId}
                onChange={(e) => setAssignId(e.target.value.toUpperCase())}
                placeholder="e.g. RG270801"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monthly Fee (₹) *
              </label>
              <input
                type="number"
                required
                value={assignFee}
                onChange={(e) => setAssignFee(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApprovingItem(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-xs font-extrabold cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                <span>Confirm Enrollment</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        {isLoading ? (
          <CardSkeleton />
        ) : !admissions || admissions.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-500">
            No online admission applications found.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E3A8A] text-white uppercase">
                <tr>
                  <th className="py-3 px-4 font-extrabold">Photo</th>
                  <th className="py-3 px-4 font-extrabold">Applicant &amp; App No.</th>
                  <th className="py-3 px-4 font-extrabold">Parent &amp; DOB</th>
                  <th className="py-3 px-4 font-extrabold">Contact &amp; Address</th>
                  <th className="py-3 px-4 font-extrabold">Course &amp; Date</th>
                  <th className="py-3 px-4 font-extrabold">Status</th>
                  <th className="py-3 px-4 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {admissions.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30">
                    <td className="py-3 px-4">
                      {item.photo_url ? (
                        <img
                          src={item.photo_url}
                          alt={item.student_name}
                          className="h-12 w-10 rounded-lg object-cover border border-slate-300"
                        />
                      ) : (
                        <div className="h-12 w-10 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold text-[10px]">
                          N/A
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-extrabold text-slate-900">
                        {item.student_name}
                      </p>
                      <p className="font-mono text-[11px] text-[#2563EB]">
                        {item.application_number}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold">{item.parent_name || "—"}</p>
                      <p className="text-[11px] text-slate-500">
                        DOB: {item.dob || "—"}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono font-bold">
                        {item.contact_number}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-[200px] truncate">
                        {item.address || "—"}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded bg-blue-50 text-[#1E3A8A] px-2 py-0.5 font-extrabold">
                        {item.course}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {item.admission_date}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                          item.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status}
                        {item.assigned_student_id
                          ? ` (${item.assigned_student_id})`
                          : ""}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === "PENDING" && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setApprovingItem(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-[11px] font-extrabold cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 px-2.5 py-1.5 text-[11px] font-extrabold cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
