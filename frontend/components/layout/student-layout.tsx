"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  CreditCard,
  IdCard,
  Images,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

const navItems = [
  { href: "/student", label: "My Profile & Fees", icon: LayoutDashboard },
  { href: "/student/fees", label: "12-Month Fee Ledger", icon: CreditCard },
  { href: "/student/profile", label: "Digital ID Card", icon: IdCard },
  { href: "/student/albums", label: "Photo Albums", icon: Images },
];

export function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navbar in Brightway Deep Trust Blue (#1E3A8A) */}
      <header className="sticky top-0 z-30 border-b border-blue-950/20 bg-[#1E3A8A] text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/student" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#FBBF24] ring-1 ring-[#FBBF24]/40">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-base font-extrabold tracking-tight text-white leading-none">
                  BRIGHTWAY
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#FBBF24] mt-0.5">
                  Student Portal (View-Only)
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1.5">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/student"
                    ? pathname === "/student"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[#F59E0B] text-slate-950 shadow-xs"
                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-extrabold text-white">
                {user?.display_name || "Student"}
              </p>
              <p className="text-[11px] font-mono text-[#FBBF24]">
                {user?.student_code || "STUDENT"}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-red-500/90 px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg p-2 text-blue-100 hover:bg-white/10"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#1E3A8A] px-4 py-3 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white hover:bg-white/10"
                >
                  <Icon className="h-4 w-4 text-[#FBBF24]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-300 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            &copy; 2027 BRIGHTWAY COMPUTER EDUCATION — Affiliated to RGYCSM (rgycsm.org)
          </span>
          <span className="font-semibold text-[#1E3A8A]">
            Secured by Razorpay &amp; 256-Bit Verification
          </span>
        </div>
      </footer>
    </div>
  );
}
