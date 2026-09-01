import { notFound } from 'next/navigation'
import { getCurrentUser, getOwnerPousada, getGuestProfile } from '@/server/queries'
import { GuestProfileView } from '@/features/hospedes'

export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [user, pousada, guest] = await Promise.all([getCurrentUser(), getOwnerPousada(), getGuestProfile(id)])
  if (!guest) notFound()

  const displayName = user?.name || user?.email || 'Proprietário'
  return <GuestProfileView displayName={displayName} pousadaName={pousada?.name ?? 'Sua pousada'} guest={guest} />
}
