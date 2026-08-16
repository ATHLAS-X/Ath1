import DossiersClient from './DossiersClient'

export default async function DossiersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DossiersClient cycleId={id} />
}
