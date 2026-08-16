import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { getOrGenerateDossier } from '@/lib/dossier'

export const dynamic = 'force-dynamic'

// Selection-panel-facing: dossier is lazy-generated on first view, then
// cached (Dossier is otherwise immutable — no regenerate action in v1).
export async function GET(req: NextRequest, { params }: { params: Promise<{ registrationId: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { registrationId } = await params
  const dossier = await getOrGenerateDossier(registrationId)
  if (!dossier) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

  return NextResponse.json({ dossier })
}
