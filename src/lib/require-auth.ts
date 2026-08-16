import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Reads and verifies the session JWT directly off the request's own
 * cookies (next-auth/jwt#getToken), rather than next-auth/next's
 * getServerSession, which depends on Next's ambient request context
 * (next/headers) and throws outside of a real server-handled request.
 * Route handlers called directly with a bare NextRequest — as
 * tests/security/auth-and-consent.test.ts does — have no such context, so
 * getToken is the only form of session verification that's actually
 * testable this way.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return null;
  return {
    id: token.id as string,
    email: (token.email as string) ?? "",
    role: (token.role as string) ?? "",
  };
}

/**
 * Every route under src/app/api/ should call this first. Returns the
 * verified session user, or a ready-to-return 401 NextResponse — callers
 * check `if (auth instanceof NextResponse) return auth;` before continuing,
 * matching this codebase's existing NextResponse-based error convention.
 */
export async function requireAuth(req: NextRequest): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}

/** Same as requireAuth, but additionally requires one of the given roles. */
export async function requireRole(
  req: NextRequest,
  roles: string[],
): Promise<{ user: SessionUser } | NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!roles.includes(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}
