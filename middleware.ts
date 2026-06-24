import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { assertNextAuthSecret } from "@/lib/env-checks";

/* Separate Edge bundle from lib/auth.ts — needs its own check at load time. */
const NEXTAUTH_SECRET = assertNextAuthSecret(process.env.NEXTAUTH_SECRET);

const AUTH_PAGES = ["/auth/login", "/auth/signup"];

/* /dashboard/<role>/* — each scoped to exactly one role. */
const ROLE_DASHBOARD_PATHS: Array<{ prefix: string; role: string }> = [
  { prefix: "/dashboard/player",     role: "player" },
  { prefix: "/dashboard/parent",     role: "parent" },
  { prefix: "/dashboard/academy",    role: "academy_admin" },
  { prefix: "/dashboard/coach",      role: "coach" },
  { prefix: "/dashboard/scout",      role: "scout" },
  { prefix: "/dashboard/tournament", role: "tournament_organizer" },
];

/* Routes that require account_status='active'. Pending users get bounced
   to their role onboarding flow. */
const DISCOVERY_PREFIXES = [
  "/scout/search",
  "/scout/watchlist",
  "/scout/compare",
  "/dashboard/scout",
  "/dashboard/academy",
  "/dashboard/tournament",
  "/discover",
];

/* Onboarding routes per role — used to redirect pending users home. */
const ONBOARDING_BY_ROLE: Record<string, string> = {
  player:               "/onboarding/player",
  parent:               "/onboarding/parent",
  academy_admin:        "/onboarding/academy",
  coach:                "/onboarding/coach",
  scout:                "/onboarding/scout",
  tournament_organizer: "/onboarding/tournament",
};

/* /api/admin, /api/scout, /api/academy — second line of defense alongside
   each route's own guard (requireAdmin / requireActiveScout / inline role
   checks). Mirrors the page-level role rules above but returns JSON 401/403
   instead of redirecting, since these are fetched by client code, not
   navigated to. */
const API_ROLE_PREFIXES: Array<{ prefix: string; roles: string[]; requireActive?: string[] }> = [
  { prefix: "/api/admin", roles: ["admin", "athlasx_admin"] },
  { prefix: "/api/scout", roles: ["scout", "admin", "athlasx_admin"], requireActive: ["scout"] },
  { prefix: "/api/academy", roles: ["academy_admin", "admin", "athlasx_admin"] },
];

function apiJsonError(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

/* Fresh Google sign-ups land with role = NULL until they pick one here —
   treated the same as a pending/inactive account: bounce away from every
   role-scoped page until it's set. NOT YET BUILT — this page doesn't exist;
   middleware will redirect to it, but the route itself needs to be created
   (this is the users.role account-type field, unrelated to any
   cricket-playing-role step in the player onboarding wizard). */
const ROLE_PICKER_PATH = "/onboarding/select-role";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: NEXTAUTH_SECRET });
  const isAuthed = Boolean(token);
  const role = (token?.role as string | undefined) ?? "";
  const accountStatus = (token?.account_status as string | undefined) ?? "pending";
  const hasNoRole = isAuthed && !role;

  /* ── API routes: JSON errors, not redirects ── */
  if (pathname.startsWith("/api/")) {
    const match = API_ROLE_PREFIXES.find((r) => pathname.startsWith(r.prefix));
    if (match) {
      if (!isAuthed) return apiJsonError(401, "Unauthorized");
      if (!match.roles.includes(role)) return apiJsonError(403, "Forbidden");
      if (match.requireActive?.includes(role) && accountStatus !== "active") {
        return apiJsonError(403, "Account is not active");
      }
    }
    return NextResponse.next();
  }

  /* ── Roleless account (post-Google-signup) — bounce to the role picker
     before any role-scoped page. Same idea as the pending-account redirect
     further down, just earlier: there's no role yet to even check against
     ROLE_DASHBOARD_PATHS/academy/scout, so this has to run first. */
  if (hasNoRole && pathname !== ROLE_PICKER_PATH && pathname !== "/" && !AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL(ROLE_PICKER_PATH, req.url));
  }

  /* ── Admin ── */
  if (pathname.startsWith("/admin")) {
    if (!isAuthed) return redirectToLogin(req, pathname);
    if (role !== "athlasx_admin" && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  /* ── Role-scoped dashboards (/dashboard/<role>/*) ── */
  const match = ROLE_DASHBOARD_PATHS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  if (match) {
    if (!isAuthed) return redirectToLogin(req, pathname);
    if (role !== match.role) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    /* Pending users can't see discovery dashboards — bounce home */
    if (accountStatus !== "active" && isDiscoveryPath(pathname)) {
      const onboarding = ONBOARDING_BY_ROLE[role] ?? "/onboarding";
      return NextResponse.redirect(new URL(onboarding, req.url));
    }
    return NextResponse.next();
  }

  /* ── Legacy /scout/* search/watchlist surfaces require active scout ── */
  if (pathname.startsWith("/scout/")) {
    if (!isAuthed) return redirectToLogin(req, pathname);
    if (role !== "scout") return NextResponse.redirect(new URL("/dashboard", req.url));
    if (accountStatus !== "active") {
      return NextResponse.redirect(new URL("/onboarding/scout", req.url));
    }
    return NextResponse.next();
  }

  /* ── Academy admin surfaces (/academy/*) ──
     Auth required. Non-academy-admins go to their own dashboard.
     /academy/onboarding has its own DB-aware page-level guard that
     redirects to /academy/dashboard if onboarding is already complete
     (middleware can't safely read the DB without a noticeable latency
     hit on every request). */
  if (pathname.startsWith("/academy")) {
    if (!isAuthed) return redirectToLogin(req, pathname);
    if (role !== "academy_admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  /* ── Root URL — if a logged-in academy admin hits the marketing
     landing, send them straight to their dashboard. Everyone else
     (logged-out visitors, other roles) keeps the landing page. */
  if (pathname === "/" && isAuthed && role === "academy_admin") {
    return NextResponse.redirect(new URL("/academy/dashboard", req.url));
  }

  /* ── Other protected routes ── */
  const protectedPrefixes = ["/dashboard", "/profile/setup", "/videos", "/onboarding"];
  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isProtected && !isAuthed) return redirectToLogin(req, pathname);

  /* ── Authed users on /auth/login or /auth/signup → role home, UNLESS
        they explicitly arrived from the landing role picker (?role=… on
        signup) or asked to switch (?switch=1). In those cases we let them
        see the form so they can register or log in as a different role. */
  if (AUTH_PAGES.includes(pathname) && isAuthed) {
    const hasRoleSwitch =
      req.nextUrl.searchParams.has("role") ||
      req.nextUrl.searchParams.has("switch");
    if (!hasRoleSwitch) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest, from: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

function isDiscoveryPath(pathname: string): boolean {
  return DISCOVERY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/academy/:path*",
    "/dashboard/:path*",
    "/scout/:path*",
    "/profile/setup/:path*",
    "/videos/:path*",
    "/onboarding/:path*",
    "/auth/:path*",
    "/discover/:path*",
    "/api/:path*",
  ],
};
