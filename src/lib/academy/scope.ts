import { db } from "@/lib/db";

/**
 * An academy_admin's own Academy row (Academy.admin_user_id). Every academy
 * route derives its academy scope from this real ownership link, never from
 * a client-supplied academyId — same "membership row is the only source of
 * access" discipline used by src/lib/association-scope.ts and
 * src/lib/squad-access.ts.
 */
export async function getOwnedAcademy(userId: string) {
  return db.academy.findUnique({ where: { admin_user_id: userId } });
}
