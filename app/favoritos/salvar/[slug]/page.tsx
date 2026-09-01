import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/queries'
import { togglePousadaFavorite, isPousadaFavorite } from '@/repositories/favorites.repository'

export const dynamic = 'force-dynamic'

export default async function SaveFavoritePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getCurrentUser()
  const returnTo = `/pousada/${slug}?favorito=salvo`

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/favoritos/salvar/${slug}`)}`)
  }

  const alreadyFavorite = await isPousadaFavorite(user.id, slug)
  if (!alreadyFavorite) {
    await togglePousadaFavorite(user.id, slug)
  }

  redirect(returnTo)
}
