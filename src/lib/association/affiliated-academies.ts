import { db } from '@/lib/db'

/**
 * An association's own self-reported list of academies it considers
 * affiliated with it — NOT the real, self-serve `Academy` model, and NOT
 * independently verified against any external source (no reliable public
 * academy-to-association directory exists — see
 * docs/AthlasX_Legal_Consent_and_Association_Research.md). Every caller of
 * this module, and every UI surface rendering its data, must keep that
 * self-reported framing rather than implying AthlasX has verified it.
 */

export interface AffiliatedAcademyRow {
  id: string
  academy_name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  status: 'active' | 'inactive'
  created_at: string
}

/** Looks up which association owns a given entry, without requiring the
 *  caller to already know it — the [id] route resolves this first, then
 *  checks it against the caller's own scope, so a mutation never needs the
 *  client to send its own associationId. */
export async function affiliatedAcademyAssociationId(academyEntryId: string): Promise<string | null> {
  const row = await db.affiliatedAcademy.findUnique({ where: { id: academyEntryId }, select: { association_id: true } })
  return row?.association_id ?? null
}

export async function listAffiliatedAcademies(associationId: string): Promise<AffiliatedAcademyRow[]> {
  const rows = await db.affiliatedAcademy.findMany({
    where: { association_id: associationId },
    orderBy: { created_at: 'desc' },
  })
  return rows.map(r => ({
    id: r.id,
    academy_name: r.academy_name,
    contact_name: r.contact_name,
    contact_phone: r.contact_phone,
    contact_email: r.contact_email,
    status: r.status,
    created_at: r.created_at.toISOString(),
  }))
}

export async function addAffiliatedAcademy(
  associationId: string,
  input: { academyName: string; contactName?: string; contactPhone?: string; contactEmail?: string },
): Promise<AffiliatedAcademyRow> {
  const r = await db.affiliatedAcademy.create({
    data: {
      association_id: associationId,
      academy_name: input.academyName,
      contact_name: input.contactName || null,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
    },
  })
  return {
    id: r.id,
    academy_name: r.academy_name,
    contact_name: r.contact_name,
    contact_phone: r.contact_phone,
    contact_email: r.contact_email,
    status: r.status,
    created_at: r.created_at.toISOString(),
  }
}

/** Scoped by association_id in the WHERE clause itself (not just checked
 *  after the fact) — an id belonging to another association simply matches
 *  zero rows, the same "not found" a nonexistent id would produce, rather
 *  than a 403 that would confirm the id exists under someone else's
 *  association. */
export async function updateAffiliatedAcademyStatus(
  associationId: string,
  academyEntryId: string,
  status: 'active' | 'inactive',
): Promise<boolean> {
  const result = await db.affiliatedAcademy.updateMany({
    where: { id: academyEntryId, association_id: associationId },
    data: { status },
  })
  return result.count > 0
}

export async function removeAffiliatedAcademy(associationId: string, academyEntryId: string): Promise<boolean> {
  const result = await db.affiliatedAcademy.deleteMany({
    where: { id: academyEntryId, association_id: associationId },
  })
  return result.count > 0
}
