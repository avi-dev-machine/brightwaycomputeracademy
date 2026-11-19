"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  GraduationCap,
  LayoutDashboard,
  CreditCard,
  Upload,
  Bell,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Wallet,
  FileCheck2,
  Images,
  Settings,
  Lock,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

const allNavItems = [
  {
    href: "/admin",
    label: "Dashboard & Student Management",
    icon: LayoutDashboard,
    superAdminOnly: true,
  },
  {
    href: "/admin/fees",
    label: "Monthly Fee Management (12M)",
    icon: CreditCard,
    superAdminOnly: false,
  },
  {
    href: "/admin/cash-flow",
    label: "Cash Flow Management (🔒)",
    icon: Wallet,
    superAdminOnly: true,
  },
  {
    href: "/admin/admissions",
    label: "Online Admission Requests",
    icon: FileCheck2,
    superAdminOnly: true,
  },
  {
    href: "/admin/albums",
    label: "Student Photo Albums",
    icon: Images,
    superAdminOnly: true,
  },
  {
    href: "/admin/import",
    label: "Excel Import & Export",
    icon: Upload,
    superAdminOnly: true,
  },
  {
    href: "/admin/notifications",
    label: "Due Fee Reminders",
    icon: Bell,
    superAdminOnly: true,
  },
  {
    href: "/admin/settings",
    label: "Admins, ON/OFF & Backup",
    icon: Settings,
    superAdminOnly: true,
  },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isRestrictedAdmin = user?.role === "ADMIN";
  const isAnyAdmin = isSuperAdmin || isRestrictedAdmin;

  useEffect(() => {
    if (!isLoading) {
      if (!user || !isAnyAdmin) {
        router.replace("/login?mode=admin");
      } else if (isRestrictedAdmin && !pathname.startsWith("/admin/fees")) {
        router.replace("/admin/fees");
      }
    }
  }, [isLoading, user, isAnyAdmin, isRestrictedAdmin, pathname, router]);

  if (isLoading || !user || !isAnyAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-sm border border-slate-200">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1E3A8A] border-t-transparent" />
          <span className="text-xs font-bold text-[#1E3A8A]">
            Verifying Administrator Session...
          </span>
        </div>
      </div>
    );
  }

  const visibleNavItems = allNavItems.filter(
    (item) => isSuperAdmin || !item.superAdminOnly
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (#1E3A8A Deep Trust Blue) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-68 flex-col bg-[#1E3A8A] text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
          <Link
            href={isSuperAdmin ? "/admin" : "/admin/fees"}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F59E0B] text-slate-950 font-black shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-extrabold tracking-tight text-white leading-none">
                BRIGHTWAY
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FBBF24] mt-0.5">
                {isSuperAdmin ? "Super Admin Portal" : "Fees Admin Portal"}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-lg p-1 text-blue-200 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/students"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition-all ${
                  isActive
                    ? "bg-[#F59E0B] text-slate-950 shadow-sm"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isRestrictedAdmin && (
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-3 text-[11px] text-blue-200 space-y-1">
              <div className="flex items-center gap-1.5 font-extrabold text-[#FBBF24]">
                <Lock className="h-3.5 w-3.5" />
                <span>Restricted Admin Access</span>
              </div>
              <p className="leading-relaxed">
                Your account is authorized exclusively for Monthly Fee Management. Cash Flow, Student Deletion, and Settings require Super Admin privileges.
              </p>
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 text-[#FBBF24] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-white">
                {user.display_name || user.student_code || "Administrator"}
              </p>
              <p className="truncate text-[10px] font-mono text-[#FBBF24]">
                ROLE: {user.role}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-red-500/90 px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-sm sm:text-base font-extrabold text-[#1E3A8A]">
                BRIGHTWAY COMPUTER EDUCATION —{" "}
                {isSuperAdmin
                  ? "Super Admin Management System"
                  : "Fees Management Desk (Restricted Admin)"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border ${
                isSuperAdmin
                  ? "bg-blue-50 border-blue-200 text-[#1E3A8A]"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {isSuperAdmin ? "SUPER ADMIN" : "FEES ADMIN"}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
