export function scoreRingPath(score: number, size: number, strokeWidth: number) {
  const r = (size - strokeWidth) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col = score >= 70 ? "#22C55E" : score >= 50 ? "#F59E0B" : "#EF4444";
  return { r, circ, fill, col };
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function relativeTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function scoreColor(score: number) {
  return score >= 70 ? "#22C55E" : score >= 50 ? "#F59E0B" : "#EF4444";
}

export const AVA_COLORS = [
  "#22C55E",
  "#3B82F6",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#EAB308",
  "#F97316",
];

export const ROLE_COLOR: Record<string, string> = {
  Batsman: "blue",
  Bowler: "green",
  "All-Rounder": "purple",
  WK: "amber",
  "Wicket-Keeper": "amber",
};

export function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? "ghost";
}

export function calcAge(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}
