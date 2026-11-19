"use client";

import Link from "next/link";
import {
  GraduationCap,
  MapPin,
  Award,
  ExternalLink,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  BookOpen,
} from "lucide-react";
import { GOOGLE_MAPS_URL, RGYCSM_COURSES_URL } from "./public-header";

export function PublicFooter() {
  return (
    <footer className="bg-[#0F172A] text-slate-300 border-t-4 border-[#F59E0B]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Column 1: Brand & RGYCSM Affiliation */}
          <div className="md:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E3A8A] text-[#FBBF24] ring-2 ring-[#F59E0B]/40">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-black tracking-tight text-white leading-none">
                  BRIGHTWAY
                </span>
                <span className="text-[11px] font-extrabold tracking-widest uppercase text-[#FBBF24] mt-1">
                  Computer Education
                </span>
              </div>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed">
              Premier centre for practical computer education, professional accounting, desktop publishing, and programming. Affiliated with{" "}
              <strong className="text-white">
                Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)
              </strong>
              .
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={RGYCSM_COURSES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 text-xs font-bold text-[#FBBF24] transition-colors"
              >
                <Award className="h-3.5 w-3.5" />
                <span>RGYCSM Affiliation</span>
                <ExternalLink className="h-3 w-3" />
              </a>

              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1E3A8A] px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 text-[#FBBF24]" />
                <span>View on Google Maps</span>
              </a>
            </div>
          </div>

          {/* Column 2: RGYCSM Certified Programs */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#FBBF24] flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              <span>RGYCSM Certified Courses</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link href="/courses" className="hover:text-[#FBBF24] transition-colors">
                  ADOAP — Advance Diploma in Office Accounting &amp; Publishing
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-[#FBBF24] transition-colors">
                  DCAE — Diploma in Computer Accounting Expert (Tally + GST)
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-[#FBBF24] transition-colors">
                  DDTP — Diploma in Desktop Publishing (Photoshop, CorelDRAW)
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-[#FBBF24] transition-colors">
                  RCIT — Certificate in Information Technology
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-[#FBBF24] transition-colors">
                  Python Programming &amp; Academic Computer Science (Class IV–XII)
                </Link>
              </li>
              <li className="pt-1">
                <a
                  href={RGYCSM_COURSES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#FBBF24] font-bold hover:underline"
                >
                  <span>Full RGYCSM Course Catalog (rgycsm.org)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Digital Student & Admin Portals */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#FBBF24]">
              Digital Portals
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link
                  href="/login"
                  className="hover:text-white inline-flex items-center gap-1 font-semibold transition-colors"
                >
                  <span>Student Login</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#FBBF24]" />
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-white transition-colors"
                >
                  Online Fee Payment (Razorpay)
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-white transition-colors"
                >
                  Digital Student ID Card
                </Link>
              </li>
              <li>
                <Link
                  href="/login?mode=admin"
                  className="hover:text-white inline-flex items-center gap-1 text-slate-400 transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#FBBF24]" />
                  <span>Admin Portal (/admin)</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Campus Location & Timings */}
          <div className="md:col-span-3 space-y-3 text-xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#FBBF24]">
              Campus &amp; Location
            </h4>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2.5">
              <p className="font-extrabold text-white text-sm">
                BRIGHTWAY COMPUTER EDUCATION
              </p>
              <p className="text-slate-300 leading-relaxed">
                Authorized Training Centre — Rajiv Gandhi Youth Computer Saksharta Mission (RGYCSM)
              </p>
              <div className="flex items-center gap-2 text-slate-300 pt-1">
                <Clock className="h-4 w-4 text-[#FBBF24] shrink-0" />
                <span>Mon – Sat: Morning &amp; Evening Batches</span>
              </div>
              <div className="pt-2">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-slate-950 font-extrabold px-3 py-2 text-xs transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Get Directions on Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            &copy; 2027 <strong className="text-white">BRIGHTWAY COMPUTER EDUCATION</strong>. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <a
              href={RGYCSM_COURSES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#FBBF24] transition-colors"
            >
              Affiliated to RGYCSM (rgycsm.org)
            </a>
            <span>•</span>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#FBBF24] transition-colors"
            >
              Verified Google Maps Location
            </a>
            <span>•</span>
            <span>Razorpay 256-Bit Secured Fee Portal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
