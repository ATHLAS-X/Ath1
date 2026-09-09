/**
 * Academy profile / onboarding field contract for Harshit's UI.
 * HIGH fields from AthlasX Master Data Points + minimal branch (V1 ticket 07).
 */

export type FieldType = "string" | "number" | "boolean" | "jsonb" | "textarr";

export const ACADEMY_PROFILE_FIELDS: Record<string, FieldType> = {
  academy_name: "string",
  description: "string",
  logo_url: "string",
  founded_year: "number",
  city: "string",
  district: "string",
  state: "string",
  country: "string",
  contact_email: "string",
  contact_phone: "string",
  contact_name: "string",
  contact_designation: "string",
  website: "string",
  social_links: "jsonb",
  age_groups: "textarr",
  facilities: "textarr",
  specialties: "textarr",
  academy_type: "string",
  bcci_affiliated: "boolean",
  bcci_affiliation_ref: "string",
  state_association_affiliated: "boolean",
  state_association_name: "string",
  head_coach_name: "string",
  active_player_count_range: "string",
  ground_type: "string",
  /** Minimal single-branch model until multi-branch is confirmed. */
  branch: "string",
};

export const ACADEMY_TYPES = [
  "Private",
  "Government",
  "Sports Club",
  "School-attached",
  "NGO",
  "Trust",
] as const;

export const GROUND_TYPES = ["Turf", "Matting", "Both"] as const;

/** Canonical ranges use an en-dash (Master Data Points). */
export const ACTIVE_PLAYER_COUNT_RANGES = ["<50", "50–100", "100–250", "250+"] as const;

const PLAYER_COUNT_ALIASES: Record<string, (typeof ACTIVE_PLAYER_COUNT_RANGES)[number]> = {
  "<50": "<50",
  "50-100": "50–100",
  "50–100": "50–100",
  "100-250": "100–250",
  "100–250": "100–250",
  "250+": "250+",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENT_YEAR = new Date().getFullYear();

export function coerceAcademyField(v: unknown, type: FieldType): unknown {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") {
    if (typeof v === "boolean") return v;
    if (v === 1 || v === "1" || v === "true") return true;
    if (v === 0 || v === "0" || v === "false") return false;
    /* Sentinel so validate can reject non-boolean junk instead of silently nulling. */
    return Symbol.for("academy.invalid_boolean");
  }
  if (type === "textarr") {
    if (Array.isArray(v)) return v.map(String);
    return null;
  }
  if (type === "jsonb") {
    return typeof v === "string" ? JSON.parse(v) : v;
  }
  return String(v);
}

const INVALID_BOOLEAN = Symbol.for("academy.invalid_boolean");

/** Returns a human-readable error or null when valid. */
export function validateAcademyField(key: string, value: unknown): string | null {
  if (value === INVALID_BOOLEAN) {
    return `${key} must be a boolean`;
  }
  if (value === null || value === undefined) return null;

  if (key === "academy_type") {
    if (!ACADEMY_TYPES.includes(value as (typeof ACADEMY_TYPES)[number])) {
      return `Invalid academy_type (allowed: ${ACADEMY_TYPES.join(", ")})`;
    }
  }
  if (key === "ground_type") {
    if (!GROUND_TYPES.includes(value as (typeof GROUND_TYPES)[number])) {
      return `Invalid ground_type (allowed: ${GROUND_TYPES.join(", ")})`;
    }
  }
  if (key === "active_player_count_range") {
    if (!(String(value) in PLAYER_COUNT_ALIASES)) {
      return `Invalid active_player_count_range (allowed: ${ACTIVE_PLAYER_COUNT_RANGES.join(", ")})`;
    }
  }
  if (key === "founded_year") {
    const y = Number(value);
    if (!Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR) {
      return `founded_year must be an integer between 1950 and ${CURRENT_YEAR}`;
    }
  }
  if (key === "contact_email" && typeof value === "string" && !EMAIL_RE.test(value)) {
    return "contact_email must be a valid email";
  }
  if (key === "academy_name" && typeof value === "string" && value.trim().length < 2) {
    return "academy_name must be at least 2 characters";
  }
  if (key === "branch" && typeof value === "string" && value.trim().length > 160) {
    return "branch must be at most 160 characters";
  }
  return null;
}

/** Normalize aliases (e.g. hyphenated player-count ranges) after coerce. */
export function normalizeAcademyField(key: string, value: unknown): unknown {
  if (key === "active_player_count_range" && typeof value === "string") {
    return PLAYER_COUNT_ALIASES[value] ?? value;
  }
  if (typeof value === "string" && (key === "academy_name" || key === "branch" || key === "contact_name")) {
    return value.trim();
  }
  return value;
}
