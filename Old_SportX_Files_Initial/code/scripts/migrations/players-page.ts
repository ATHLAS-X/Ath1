/* Migration for the academy Players management pages.
   Run once when Neon is reachable:
     npx tsx scripts/migrations/players-page.ts
*/
import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "../../lib/db";

(async () => {
  /* 1. Invite tokens on player_profiles.
     `claimed_at` already exists in the live schema (the column we use to
     mean "account_claimed"). */
  await sql`ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS invite_token VARCHAR(120)`;
  await sql`ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMP`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_invite_token_idx ON player_profiles (invite_token) WHERE invite_token IS NOT NULL`;

  /* 2. Single-row-per-player performance summary, distinct from the
     format-keyed `performance_stats` table that auto-onboards via the
     player wizard. Academy admins edit this directly. */
  await sql`
    CREATE TABLE IF NOT EXISTS player_performance_summary (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      matches INT, innings INT, runs INT, batting_average NUMERIC(6,2),
      strike_rate NUMERIC(6,2), highest_score INT, fifties INT, hundreds INT,
      bowling_matches INT, wickets INT, overs NUMERIC(7,1),
      economy NUMERIC(5,2), bowling_average NUMERIC(6,2), best_figures VARCHAR(20),
      catches INT, stumpings INT, runouts INT,
      updated_at TIMESTAMP DEFAULT NOW(),
      updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  /* 3. Multi-row fitness assessments — different from the single-row
     fitness_data that lives on the player onboarding. */
  await sql`
    CREATE TABLE IF NOT EXISTS player_fitness_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assessment_date DATE NOT NULL,
      yoyo_score NUMERIC(5,2),
      sprint_30m NUMERIC(5,2),
      run_2km NUMERIC(6,2),
      notes TEXT,
      is_supervised BOOLEAN NOT NULL DEFAULT FALSE,
      assessed_by_coach_id UUID REFERENCES academy_coaches(id) ON DELETE SET NULL,
      created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pfa_user_idx ON player_fitness_assessments (user_id, assessment_date DESC)`;

  console.log("players-page schema applied");
})();
