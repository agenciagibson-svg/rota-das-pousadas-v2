import { getCityDestination, getDestinations, getStateDestination } from '@/server/queries'
import { cityPhoto, destinationTitle, isStateSlug, stateTitle } from '@/features/destinos'
import { cityGuide } from '@/features/destinos/guias'
import { ogCard, OG_SIZE } from '@/lib/og-card'
import { formatPrice } from '@/lib/format'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'Pousadas na Rota das Pousadas'

function count(n: number) {
  return n === 1 ? '1 pousada' : `${n} pousadas`
}

/** Prévia do link da cidade ou do estado: foto, título e preço inicial. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (isStateSlug(slug)) {
    const st = await getStateDestination(slug)
    if (!st) return ogCard({ title: 'Rota das Pousadas', subtitle: 'Pousadas com reserva direta' })
    const first = st.cities[0]
    return ogCard({
      photo: first ? (cityGuide(first.slug)?.hero.src ?? first.image) : null,
      title: stateTitle(st),
      subtitle: 'Reserva direta, sem intermediário',
      badges: [
        count(st.pousadas),
        st.priceFrom > 0 ? `A partir de ${formatPrice(st.priceFrom)}` : '',
      ].filter(Boolean),
    })
  }
  const d = await getCityDestination(slug)
  if (!d) return ogCard({ title: 'Rota das Pousadas', subtitle: 'Pousadas com reserva direta' })
  const photo = cityPhoto(d, await getDestinations()) ?? cityGuide(d.slug)?.hero.src ?? d.image
  return ogCard({
    photo,
    title: destinationTitle(d),
    subtitle: 'Reserva direta, sem intermediário',
    badges: [
      count(d.pousadas.length),
      d.priceFrom > 0 ? `A partir de ${formatPrice(d.priceFrom)}` : '',
    ].filter(Boolean),
  })
}
