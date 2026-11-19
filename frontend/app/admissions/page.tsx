"use client";

import { useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  PublicHeader,
  RGYCSM_COURSES_URL,
  GOOGLE_MAPS_URL,
} from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import {
  CheckCircle2,
  Send,
  GraduationCap,
  Camera,
  Award,
  MapPin,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

const COURSE_OPTIONS = [
  { code: "ADOAP", label: "ADOAP — Advance Diploma in Office Accounting & Publishing (12 Months)" },
  { code: "DCAE", label: "DCAE — Diploma in Computer Accounting Expert (Tally + GST)" },
  { code: "DDTP", label: "DDTP — Diploma in Desktop Publishing (Photoshop, CorelDRAW)" },
  { code: "RCIT", label: "RCIT — RGYCSM Certificate in Information Technology" },
  { code: "PYTHON", label: "PYTHON — Python Programming & Software Development" },
  { code: "CLASS 4-8", label: "Academic Computer Science (Class IV to Class VIII)" },
  { code: "CLASS 9-12", label: "Academic Computer Science (Class IX to Class XII — ICSE/CBSE/WB)" },
];

function OnlineAdmissionFormContent() {
  const searchParams = useSearchParams();
  const initialCourse = searchParams.get("course") || "ADOAP";

  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [dob, setDob] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [course, setCourse] = useState(initialCourse);
  const [admissionDate, setAdmissionDate] = useState("2027-12-01");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    application_number: string;
    student_name: string;
    course: string;
    admission_date: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Photograph must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/backend/v1/admissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName.trim(),
          parent_name: parentName.trim(),
          dob,
          contact_number: contactNumber.trim(),
          address: address.trim(),
          course,
          admission_date: admissionDate,
          photo_data_url: photoDataUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          json?.error?.message || "Failed to submit online admission form."
        );
      }
      setSubmittedRecord(json.data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Unable to submit online admission form."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Header */}
        <section className="bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B] text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase">
              <Award className="h-3.5 w-3.5" />
              Affiliated to RGYCSM (rgycsm.org)
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-black">
              BRIGHTWAY COMPUTER EDUCATION — Online Admission Form
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 max-w-2xl mx-auto">
              Complete the official online admission form below. Once submitted, your application is routed directly to the Super Admin dashboard for verification and Student ID issuance.
            </p>
          </div>
        </section>

        <section className="py-10">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            {submittedRecord ? (
              <div className="rounded-2xl border-2 border-emerald-300 bg-white p-8 shadow-lg text-center space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div className="space-y-1">
                  <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-extrabold uppercase">
                    Application Submitted for Super Admin Approval
                  </span>
                  <h2 className="text-2xl font-black text-[#1E3A8A]">
                    Thank You, {submittedRecord.student_name}!
                  </h2>
                  <p className="text-xs text-slate-600">
                    Your online admission application has been registered and sent to the Super Admin dashboard.
                  </p>
                </div>

                <div className="mx-auto max-w-md rounded-xl bg-slate-50 border border-slate-200 p-4 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Application No.:</span>
                    <span className="font-mono font-extrabold text-[#1E3A8A]">
                      {submittedRecord.application_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Selected Course:</span>
                    <span className="font-extrabold text-slate-900">
                      {submittedRecord.course}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Admission Date:</span>
                    <span className="font-bold text-slate-800">
                      {submittedRecord.admission_date}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Verification Status:</span>
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-extrabold">
                      PENDING APPROVAL
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedRecord(null);
                      setStudentName("");
                      setParentName("");
                      setDob("");
                      setContactNumber("");
                      setAddress("");
                      setPhotoDataUrl(null);
                    }}
                    className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-extrabold text-slate-700 cursor-pointer"
                  >
                    Submit Another Admission Form
                  </button>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-5 py-2.5 text-xs font-extrabold"
                  >
                    <span>Go to Student Login</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#FBBF24]" />
                  </Link>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E3A8A] text-[#FBBF24]">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-[#1E3A8A]">
                        Student Admission Application
                      </h2>
                      <p className="text-xs text-slate-500">
                        BRIGHTWAY COMPUTER EDUCATION • Affiliated to RGYCSM
                      </p>
                    </div>
                  </div>
                  <a
                    href={RGYCSM_COURSES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#2563EB] hover:underline"
                  >
                    RGYCSM Courses
                  </a>
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. Student Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Enter full name"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. Parent&apos;s Name (Father&apos;s / Mother&apos;s Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="Father's or Mother's Name"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      3. Date of Birth *
                    </label>
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      4. Contact Number (10-Digit Mobile / WhatsApp) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono font-bold focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      5. Residential Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House / Street / Locality / Pin Code"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      6. Course Selection *
                    </label>
                    <select
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-[#1E3A8A] focus:border-[#2563EB] focus:outline-hidden"
                    >
                      {COURSE_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      7. Admission Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={admissionDate}
                      onChange={(e) => setAdmissionDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  {/* Photograph Upload */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      8. Student Photograph Upload (Passport Portrait — PNG/JPEG, Max 2 MB)
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
                      {photoDataUrl ? (
                        <img
                          src={photoDataUrl}
                          alt="Student Preview"
                          className="h-24 w-20 rounded-xl object-cover border-2 border-[#1E3A8A] shadow-xs"
                        />
                      ) : (
                        <div className="flex h-24 w-20 items-center justify-center rounded-xl bg-blue-100 text-[#1E3A8A] font-bold text-xs">
                          No Photo
                        </div>
                      )}
                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <p className="text-xs text-slate-600">
                          Upload or capture a clear passport-size photograph for your Digital Student ID Card.
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          capture="user"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1E3A8A] text-white px-4 py-2 text-xs font-extrabold cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5 text-[#FBBF24]" />
                          <span>
                            {photoDataUrl
                              ? "Change Photograph"
                              : "Capture / Upload Photograph"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] hover:from-[#2563EB] hover:to-[#1E3A8A] text-white font-extrabold py-3.5 px-6 text-sm shadow-lg transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#FBBF24]" />
                    ) : (
                      <Send className="h-4 w-4 text-[#FBBF24]" />
                    )}
                    <span>
                      {isSubmitting
                        ? "Submitting Admission Form..."
                        : "Submit Online Admission Application"}
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#1E3A8A]"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#F59E0B]" />
                    <span>Visit Campus on Google Maps</span>
                  </a>
                  <span>Verified by Super Admin before Student ID issuance</span>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default function AdmissionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <PublicHeader />
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1E3A8A] border-t-transparent" />
          </div>
          <PublicFooter />
        </div>
      }
    >
      <OnlineAdmissionFormContent />
    </Suspense>
  );
}
