import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { notFound } from 'next/navigation'
import { getCurrentUser, getOwnerPousada, getGuestProfile } from '@/server/queries'
import { GuestProfileView } from '@/features/hospedes'

export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  if (await sectionDenied('hospedes')) return <NoSectionAccess section="hospedes" title="Hóspede" />

  const { id } = await params
  const [user, pousada, guest] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getGuestProfile(id),
  ])
  if (!guest) notFound()

  const displayName = user?.name || user?.email || 'Proprietário'
  return (
    <GuestProfileView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      guest={guest}
    />
  )
}
