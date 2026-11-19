"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface ImportedStudentSample {
  student_id: string;
  name: string;
  contact_number: string;
  batch: string;
  monthly_fee: number;
  passcode: string;
}

interface ExcelImportResult {
  id: string;
  file_name: string;
  status: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  failed_rows: number;
  duplicate_ids_skipped?: string[];
  fee_records_upserted: number;
  error_summary?: {
    errors?: Array<{ row_number: number; student_id: string; error: string }>;
    sample_students?: ImportedStudentSample[];
  };
}

export default function AdminExcelImportExportPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [exportYear, setExportYear] = useState("2027");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setIsUploading(true);
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
        throw new Error(json?.error?.message || "Excel/CSV import failed.");
      }

      setResult(json.data);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        type: "success",
        title: "Excel / CSV Import Complete",
        description: `Processed ${json.data.total_rows} rows (Inserted: ${json.data.inserted_rows}, Updated: ${json.data.updated_rows}).`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "Upload Error",
        description:
          err instanceof Error
            ? err.message
            : "Could not process Excel/CSV file.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = [
      "Name,Contact Number,Course,Student ID,Monthly Fee,Parent Name,Address,Admission Date,Status",
      "AGNIRUDRA BASU,7980353213,ADOAP,RG240017,800,SUBRATA BASU,Alambazar Kolkata,2026-01-10,ACTIVE",
      "FARDEEN IQBAL,9163197952,DCAE,RG230031,900,MD IQBAL,Baranagar Kolkata,2026-01-15,ACTIVE",
      "ABHIGYAN MALLICK,9748488869,PYTHON,BW240038,600,S MALLICK,Dakshineswar Kolkata,2026-02-01,ACTIVE",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brightway-sample-import.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-[#2563EB] px-3 py-0.5 text-xs font-extrabold uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            Excel (.xlsx) &amp; CSV Bulk Data Center
          </span>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold text-[#1E3A8A]">
            Excel Import &amp; Export Management
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Bulk-import student sheets (<code className="font-mono font-bold">.xlsx</code> or <code className="font-mono font-bold">.csv</code>) with duplicate Student ID validation, and export Student Records, 12-Month Fee Ledgers, and Payment History in Excel format.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadSampleCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-[#1E3A8A] transition-colors cursor-pointer"
        >
          <Download className="h-4 w-4 text-[#F59E0B]" />
          <span>Download Sample Template</span>
        </button>
      </div>

      {/* 1-Click Excel (.xlsx) & CSV Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 text-[#1E3A8A] px-2.5 py-1 text-[11px] font-extrabold">
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#2563EB]" />
              Complete Student Database
            </span>
            <h3 className="mt-2 font-display text-base font-extrabold text-slate-900">
              Export Student Records
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Includes Student ID, Name, Parent Name, Contact, Address, Course, Admission Date, Monthly Fee, and Active/Inactive Status.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <a
              href="/api/backend/v1/imports/export/students.xlsx"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-3.5 py-2.5 text-xs font-extrabold transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#FBBF24]" />
              <span>Download Excel (.xlsx)</span>
            </a>
            <a
              href="/api/backend/v1/imports/export/students.csv"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2.5 text-xs font-bold"
            >
              CSV
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-800 px-2.5 py-1 text-[11px] font-extrabold">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                12-Month Fee Matrix
              </span>
              <select
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-[#1E3A8A]"
              >
                <option value="2026">Year 2026</option>
                <option value="2027">Year 2027</option>
                <option value="2028">Year 2028</option>
              </select>
            </div>
            <h3 className="mt-2 font-display text-base font-extrabold text-slate-900">
              Export Monthly Fee Records
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Month-wise Paid/Unpaid ledger for all 12 months (Jan–Dec {exportYear}) with total paid &amp; pending balances.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <a
              href={`/api/backend/v1/imports/export/monthly-fees.xlsx?year=${exportYear}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2.5 text-xs font-extrabold transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#FBBF24]" />
              <span>Download Excel (.xlsx)</span>
            </a>
            <a
              href={`/api/backend/v1/imports/export/monthly-fees.csv?year=${exportYear}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2.5 text-xs font-bold"
            >
              CSV
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-900 px-2.5 py-1 text-[11px] font-extrabold">
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#F59E0B]" />
              Verified Transactions
            </span>
            <h3 className="mt-2 font-display text-base font-extrabold text-slate-900">
              Export Payment History
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Complete payment history with Receipt No, Student ID, Month, Amount, Payment Mode, Transaction ID, and Received By.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <a
              href="/api/backend/v1/imports/export/payments.xlsx"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 px-3.5 py-2.5 text-xs font-extrabold transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Excel (.xlsx)</span>
            </a>
            <a
              href="/api/backend/v1/imports/export/payments.csv"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2.5 text-xs font-bold"
            >
              CSV
            </a>
          </div>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="rounded-2xl border-2 border-dashed border-[#2563EB]/40 bg-blue-50/30 p-10 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
          className="hidden"
        />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E3A8A] text-[#FBBF24] shadow-md">
          <FileSpreadsheet className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-lg font-extrabold text-[#1E3A8A]">
          Upload Excel (.xlsx) or CSV Student File
        </h2>
        <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
          Supports multiple students at once. Validates duplicate Student IDs within the uploaded file and displays row-level import errors clearly.
        </p>

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] disabled:opacity-60 text-white px-6 py-3 text-sm font-extrabold shadow-md transition-colors cursor-pointer"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#FBBF24]" />
          ) : (
            <Upload className="h-4 w-4 text-[#FBBF24]" />
          )}
          <span>
            {isUploading
              ? "Importing Excel / CSV Data..."
              : "Select Excel (.xlsx) or CSV File"}
          </span>
        </button>
      </div>

      {/* Ingestion Result Summary */}
      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Completed Import: {result.file_name}
              </h3>
              <p className="text-xs text-slate-500">
                Total Rows: <strong>{result.total_rows}</strong> • Inserted:{" "}
                <strong>{result.inserted_rows}</strong> • Updated:{" "}
                <strong>{result.updated_rows}</strong> • Failed/Duplicates:{" "}
                <strong>{result.failed_rows}</strong>
              </p>
            </div>
          </div>

          {result.error_summary?.errors &&
            result.error_summary.errors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                  <span>
                    Import Validation Warnings / Duplicate IDs (
                    {result.error_summary.errors.length})
                  </span>
                </div>
                <ul className="text-xs text-amber-800 space-y-1 max-h-40 overflow-y-auto font-mono">
                  {result.error_summary.errors.map((err, idx) => (
                    <li key={idx}>
                      Row #{err.row_number} ({err.student_id}): {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {result.error_summary?.sample_students &&
            result.error_summary.sample_students.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                  Sample Imported Student Credentials
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 font-bold">Student ID</th>
                        <th className="py-2.5 px-4 font-bold">Name</th>
                        <th className="py-2.5 px-4 font-bold">Course</th>
                        <th className="py-2.5 px-4 font-bold">Contact</th>
                        <th className="py-2.5 px-4 font-bold">Monthly Fee</th>
                        <th className="py-2.5 px-4 font-bold">Login Passcode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.error_summary.sample_students.map((s) => (
                        <tr key={s.student_id}>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#1E3A8A]">
                            {s.student_id}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {s.name}
                          </td>
                          <td className="py-2.5 px-4">{s.batch}</td>
                          <td className="py-2.5 px-4 font-mono">
                            {s.contact_number}
                          </td>
                          <td className="py-2.5 px-4 font-bold">
                            ₹{s.monthly_fee}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-extrabold text-emerald-700">
                            {s.passcode}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
