export const PLAYING_ROLES = [
  "Powerplay Opener",
  "Middle-Order Batter",
  "Finisher",
  "Death Bowler",
  "Swing Bowler",
  "Spinner",
  "Wicket-Keeper",
  "All-Rounder",
] as const;

export const BATTING_STYLES = ["Right Hand Bat", "Left Hand Bat"] as const;

export const BOWLING_STYLES = [
  "Right Arm Fast",
  "Right Arm Medium",
  "Right Arm Off-Spin",
  "Right Arm Leg-Spin",
  "Left Arm Fast",
  "Left Arm Medium",
  "Left Arm Orthodox",
  "Left Arm Wrist-Spin",
  "Does Not Bowl",
] as const;

export type PlayingRole = (typeof PLAYING_ROLES)[number];
export type BattingStyle = (typeof BATTING_STYLES)[number];
export type BowlingStyle = (typeof BOWLING_STYLES)[number];

export interface PlayerProfile {
  id: string;
  user_id: string;
  city: string | null;
  state: string | null;
  district: string | null;
  date_of_birth: string | null;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  matches_played: number;
  runs_scored: number;
  wickets_taken: number;
  highest_score: number;
  best_bowling: string | null;
  bio: string | null;
  avatar_url: string | null;
}

/** A profile is "complete" once the core identity + at least one stat field is populated. */
export function isProfileComplete(p: PlayerProfile | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    p.city &&
      p.state &&
      p.district &&
      p.date_of_birth &&
      p.playing_role &&
      p.batting_style &&
      p.bowling_style,
  );
}
