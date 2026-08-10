import type { UserRole, AccountStatus } from "./auth";

/**
 * Where a user lands after login / signup based on (role, account_status).
 *
 * Pending users complete onboarding for their role. Active users go to their
 * dashboard. AthlasX Admin skips onboarding entirely.
 */
export function getRedirectByRole(user: {
  role?: UserRole | string | null;
  account_status?: AccountStatus | string | null;
}): string {
  const role = (user.role ?? "player") as UserRole;
  const status = (user.account_status ?? "pending") as AccountStatus;

  if (role === "athlasx_admin") return "/admin";
  if (status === "suspended") return "/auth/suspended";

  /* Pending → finish onboarding */
  if (status === "pending") {
    switch (role) {
      case "player":               return "/onboarding/player";
      case "academy_admin":        return "/onboarding/academy";
      case "scout":                return "/onboarding/scout";
      case "coach":                return "/onboarding/coach";
      case "tournament_organizer": return "/onboarding/tournament";
      case "parent":               return "/onboarding/parent";
      default:                     return "/onboarding";
    }
  }

  /* Active → role dashboard */
  switch (role) {
    case "player":               return "/dashboard/player";
    case "academy_admin":        return "/academy/dashboard";
    case "scout":                return "/dashboard/scout";
    case "coach":                return "/dashboard/coach";
    case "tournament_organizer": return "/dashboard/tournament";
    case "parent":               return "/dashboard/parent";
    default:                     return "/dashboard/player";
  }
}

/** Which dashboard prefix is allowed for which role. */
export const ROLE_DASHBOARD_PREFIX: Record<UserRole, string> = {
  player:               "/dashboard/player",
  parent:               "/dashboard/parent",
  academy_admin:        "/dashboard/academy",
  coach:                "/dashboard/coach",
  scout:                "/dashboard/scout",
  tournament_organizer: "/dashboard/tournament",
  athlasx_admin:         "/admin",
};
