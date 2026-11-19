import { NextResponse, type NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "bw_access_token";
const REFRESH_TOKEN_COOKIE = "bw_refresh_token";
const USER_COOKIE = "bw_user";

interface JwtPayload {
  sub?: string;
  role?: string;
  identifier?: string;
  iss?: string;
  exp?: number;
}

const VALID_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "STUDENT"]);

function decodeBrightwayJwt(
  token: string
): { payload: JwtPayload; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const json = atob(padded);
    const payload = JSON.parse(json) as JwtPayload;
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    if (payload.iss !== "brightway-portal") {
      return null;
    }
    const role = payload.role ? String(payload.role).toUpperCase() : "";
    if (!VALID_ROLES.has(role)) {
      return null;
    }
    return { payload, role };
  } catch {
    return null;
  }
}

function clearStaleCookies(res: NextResponse): NextResponse {
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
  res.cookies.delete(USER_COOKIE);
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  const isAuthPage = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const isStudentRoute = pathname.startsWith("/student");

  const decoded = token ? decodeBrightwayJwt(token) : null;
  const role = decoded?.role ?? null;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isRestrictedAdmin = role === "ADMIN";
  const isAnyAdmin = isSuperAdmin || isRestrictedAdmin;

  if (isAuthPage) {
    if (token && !decoded) {
      return clearStaleCookies(NextResponse.next());
    }
    return NextResponse.next();
  }

  if ((isAdminRoute || isStudentRoute) && !decoded) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return clearStaleCookies(NextResponse.redirect(loginUrl));
  }

  // Enforce strict Three-Level RBAC on /admin and /student routes
  if (isAdminRoute && !isAnyAdmin) {
    return NextResponse.redirect(new URL("/student", request.url));
  }

  // Restricted ADMIN can ONLY access /admin/fees (Monthly Fee Management)
  if (isAdminRoute && isRestrictedAdmin) {
    if (!pathname.startsWith("/admin/fees")) {
      return NextResponse.redirect(new URL("/admin/fees", request.url));
    }
  }

  if (isStudentRoute && role !== "STUDENT") {
    return NextResponse.redirect(
      new URL(isRestrictedAdmin ? "/admin/fees" : "/admin", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/student/:path*", "/login"],
};
