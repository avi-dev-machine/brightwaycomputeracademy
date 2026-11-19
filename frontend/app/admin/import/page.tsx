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

interface CsvImportResult {
  id: string;
  file_name: string;
  status: string;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  failed_rows: number;
  fee_records_upserted: number;
  error_summary?: {
    errors?: Array<{ row_number: number; student_id: string; error: string }>;
    sample_students?: ImportedStudentSample[];
  };
}

export default function AdminCsvImportPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
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
        throw new Error(json?.error?.message || "CSV ingestion failed.");
      }

      setResult(json.data);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        type: "success",
        title: "CSV Ingestion Complete",
        description: `Upserted ${json.data.total_rows} student records without duplicates.`,
      });
    } catch (err) {
      toast({
        type: "error",
        title: "CSV Upload Error",
        description:
          err instanceof Error ? err.message : "Could not process CSV file.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = [
      "Name,Contact Number,Batch,Student ID,Monthly Fee",
      "AGNIRUDRA BASU,7980353213,ADOAP,RG240017,800",
      "FARDEEN IQBAL,9163197952,DCAE,RG230031,900",
      "ABHIGYAN MALLICK,9748488869,PYTHON,BW240038,600",
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brightway-sample-5col.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-[#2563EB] px-3 py-0.5 text-xs font-extrabold uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            Streaming Line-by-Line CSV Parser
          </span>
          <h1 className="mt-1.5 font-display text-2xl font-extrabold text-[#1E3A8A]">
            Student CSV Data Ingestion Engine
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Accepts standard 5-column CSVs (<code className="font-mono font-bold">Name, Contact Number, Batch, Student ID, Monthly Fee</code>) and Brightway batch sheets. Upserts without duplicating records.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadSampleCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-extrabold text-[#1E3A8A] transition-colors cursor-pointer"
        >
          <Download className="h-4 w-4 text-[#F59E0B]" />
          <span>Download Sample 5-Col CSV</span>
        </button>
      </div>

      {/* Upload Dropzone */}
      <div className="rounded-2xl border-2 border-dashed border-[#2563EB]/40 bg-blue-50/30 p-10 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
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
          Upload Authorized Student CSV File
        </h2>
        <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
          Stream-parsed line-by-line in O(1) memory. Existing Student IDs are updated cleanly; new Student IDs are inserted automatically.
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
            {isUploading ? "Streaming & Upserting CSV..." : "Select CSV File to Ingest"}
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
                Completed Ingestion: {result.file_name}
              </h3>
              <p className="text-xs text-slate-500">
                Total Rows: <strong>{result.total_rows}</strong> • Inserted:{" "}
                <strong>{result.inserted_rows}</strong> • Updated:{" "}
                <strong>{result.updated_rows}</strong> • Fee Records:{" "}
                <strong>{result.fee_records_upserted}</strong>
              </p>
            </div>
          </div>

          {result.error_summary?.sample_students &&
            result.error_summary.sample_students.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3">
                  Sample Upserted Student Credentials
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 font-bold">Student ID</th>
                        <th className="py-2.5 px-4 font-bold">Name</th>
                        <th className="py-2.5 px-4 font-bold">Batch</th>
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
