"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  Menu,
  X,
  ArrowRight,
  LayoutDashboard,
  ShieldCheck,
  MapPin,
  Award,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

export const GOOGLE_MAPS_URL = "https://share.google/ckM9UxaHIv8pXOjjd";
export const RGYCSM_COURSES_URL = "https://www.rgycsm.org/courses";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "RGYCSM Courses" },
  { href: "/admissions", label: "Online Admission" },
  { href: "/about", label: "About & Affiliation" },
  { href: "/contact", label: "Campus Location" },
];

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, role } = useAuth();

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const dashboardHref = isAdmin ? "/admin" : "/student";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
      {/* Top Institutional Affiliation & Location Strip */}
      <div className="bg-[#0F172A] text-white text-xs py-2 px-4 border-b border-white/10">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 font-medium">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F59E0B] text-slate-950 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
              <Award className="h-3 w-3" />
              RGYCSM Affiliated
            </span>
            <span className="text-slate-200 hidden sm:inline">
              BRIGHTWAY COMPUTER EDUCATION — Authorized RGYCSM Computer Training Centre
            </span>
            <span className="text-slate-200 sm:hidden font-bold">
              BRIGHTWAY COMPUTER EDUCATION
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <a
              href={RGYCSM_COURSES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1 hover:text-[#FBBF24] transition-colors font-medium"
            >
              <span>RGYCSM Official Syllabus</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="hidden md:inline text-slate-600">|</span>
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#FBBF24] hover:text-white transition-colors font-semibold"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Google Maps Location</span>
            </a>
            <span className="text-slate-600">|</span>
            <Link
              href="/login?mode=admin"
              className="inline-flex items-center gap-1 text-slate-300 hover:text-[#FBBF24] transition-colors font-medium"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#FBBF24]" />
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Identity */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] text-[#FBBF24] shadow-md ring-2 ring-[#F59E0B]/30 transition-transform group-hover:scale-105">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg sm:text-xl font-black tracking-tight text-[#1E3A8A] leading-none">
              BRIGHTWAY
            </span>
            <span className="text-[11px] font-extrabold tracking-widest uppercase text-[#F59E0B] mt-1">
              Computer Education
            </span>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center gap-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? "bg-[#1E3A8A] text-white shadow-xs"
                    : "text-slate-700 hover:text-[#1E3A8A] hover:bg-blue-50/80"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-extrabold text-white shadow-md hover:bg-[#2563EB] transition-colors"
            >
              <LayoutDashboard className="h-4 w-4 text-[#FBBF24]" />
              <span>{isAdmin ? "Admin Dashboard" : "Student Dashboard"}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login?mode=admin"
                className="text-xs font-bold text-slate-500 hover:text-[#1E3A8A] px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Admin Login
              </Link>
              <Link
                href="/admissions"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#FBBF24] px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition-all"
              >
                <span>Online Admission Form</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-blue-900/15 hover:from-[#2563EB] hover:to-[#1E3A8A] transition-all"
              >
                <span>Student Login</span>
                <ArrowRight className="h-4 w-4 text-[#FBBF24]" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex md:hidden items-center justify-center rounded-xl p-2.5 text-[#1E3A8A] hover:bg-blue-50"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-2xl">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-blue-50 hover:text-[#1E3A8A]"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2 text-xs">
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 font-bold text-[#1E3A8A]"
            >
              <MapPin className="h-4 w-4 text-[#F59E0B]" />
              <span>Open Campus Location on Google Maps</span>
            </a>
            <a
              href={RGYCSM_COURSES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 font-bold text-[#1E3A8A]"
            >
              <Award className="h-4 w-4 text-[#F59E0B]" />
              <span>View Official RGYCSM Courses</span>
            </a>
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <Link
              href={isAuthenticated ? dashboardHref : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-extrabold text-white shadow-sm"
            >
              <span>{isAuthenticated ? "Open Dashboard" : "Student Login"}</span>
              <ArrowRight className="h-4 w-4 text-[#FBBF24]" />
            </Link>
            {!isAuthenticated && (
              <Link
                href="/login?mode=admin"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center text-xs font-bold text-slate-500 hover:text-[#1E3A8A] py-1.5"
              >
                Admin Portal Access
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
