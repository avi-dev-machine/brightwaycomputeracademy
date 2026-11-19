"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  ArrowRight,
  MapPin,
} from "lucide-react";
import {
  PublicHeader,
  GOOGLE_MAPS_URL,
  RGYCSM_COURSES_URL,
} from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { rgycsmCourses } from "../page";

export default function CoursesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = rgycsmCourses.filter((c) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.highlights.some((h) => h.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <PublicHeader />

      <main className="flex-1">
        {/* Page Hero */}
        <section className="bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#2563EB] text-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F59E0B] text-slate-950 px-3.5 py-1 text-xs font-extrabold uppercase">
                  <Award className="h-3.5 w-3.5" />
                  <span>Affiliated with RGYCSM (rgycsm.org/courses)</span>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-black">
                  BRIGHTWAY COMPUTER EDUCATION — Course Directory
                </h1>
                <p className="text-sm text-blue-100 leading-relaxed">
                  Explore our RGYCSM-affiliated Advance Diplomas, Accounting &amp; Desktop Publishing programs, Certificate courses, and Class IV–XII Computer Science coaching.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={RGYCSM_COURSES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 font-extrabold px-5 py-3 text-xs shadow-lg transition-colors"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Official RGYCSM Course Catalog</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-4 py-3 text-xs transition-colors"
                >
                  <MapPin className="h-4 w-4 text-[#FBBF24]" />
                  <span>Campus Location</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Search Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ADOAP, DCAE, DDTP, Tally, Photoshop, Python..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-xs font-medium focus:border-[#2563EB] focus:outline-hidden"
                />
              </div>
              <div className="text-xs text-slate-600 font-medium">
                Showing <strong>{filtered.length}</strong> RGYCSM &amp; Academic Programs
              </div>
            </div>

            {/* Course Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filtered.map((item) => (
                <div
                  key={item.code}
                  className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <span className="rounded-lg bg-[#1E3A8A] text-[#FBBF24] px-3 py-1 text-xs font-black">
                        {item.code}
                      </span>
                      <span className="rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200 px-3 py-1 text-xs font-extrabold">
                        {item.monthlyFee}
                      </span>
                    </div>

                    <h2 className="text-xl font-extrabold text-slate-900 mb-2">
                      {item.title}
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 font-semibold mb-4 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#F59E0B]" />
                        Duration: <strong>{item.duration}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Eligibility: <strong>{item.eligibility}</strong>
                      </span>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      {item.highlights.map((h) => (
                        <div
                          key={h}
                          className="flex items-start gap-2 text-xs text-slate-700 font-medium"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <a
                      href={RGYCSM_COURSES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3A8A] hover:underline"
                    >
                      <span>Official RGYCSM Syllabus</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A8A] hover:bg-[#2563EB] text-white px-4 py-2 text-xs font-extrabold transition-colors"
                    >
                      <span>Student Portal Login</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#FBBF24]" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
