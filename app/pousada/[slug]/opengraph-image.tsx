import { getPousada } from '@/server/queries'
import { ogCard, OG_SIZE } from '@/lib/og-card'
import { formatPrice } from '@/lib/format'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Pousada na Rota das Pousadas'

/** Prévia do link da pousada (WhatsApp, redes): foto, nome, cidade, preço e nota. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await getPousada(slug)
  if (!p) return ogCard({ title: 'Rota das Pousadas', subtitle: 'Pousadas com reserva direta' })
  const badges = [
    p.pricePerNight > 0 ? `Diária a partir de ${formatPrice(p.pricePerNight)}` : '',
    p.reviews > 0 ? `★ ${p.rating.toFixed(1)}` : '',
  ].filter(Boolean)
  return ogCard({
    photo: p.image,
    title: p.name,
    subtitle: `${p.city}, ${p.state}`,
    badges,
  })
}
