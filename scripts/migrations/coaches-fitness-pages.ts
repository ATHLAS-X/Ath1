/* Migration for the academy Coaches + Fitness pages.
   Adds soft-delete to academy_coaches. Idempotent.
     npx tsx scripts/migrations/coaches-fitness-pages.ts
*/
import { config } from "dotenv";
config({ path: ".env.local" });
import { sql } from "../../lib/db";

(async () => {
  await sql`ALTER TABLE academy_coaches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`;
  await sql`CREATE INDEX IF NOT EXISTS academy_coaches_deleted_idx ON academy_coaches (academy_id, deleted_at)`;
  console.log("coaches-fitness migration applied");
})();
