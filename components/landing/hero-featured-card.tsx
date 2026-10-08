import Image from 'next/image'
import Link from 'next/link'
import type { Pousada } from '@/types'
import { formatPrice } from '@/lib/format'

/**
 * Card de vidro que flutua sobre a foto do hero (só em telas largas): a
 * primeira pousada em destaque, já com preço, para o caminho até a reserva
 * começar na primeira dobra.
 */
export function HeroFeaturedCard({ pousada }: { pousada: Pousada }) {
  return (
    <Link
      href={`/pousada/${pousada.slug}`}
      className="group glass-dark shadow-premium absolute top-32 right-8 z-10 hidden w-80 overflow-hidden rounded-3xl border transition-transform duration-(--motion-fade) hover:-translate-y-1 xl:block 2xl:right-[calc((100vw_-_80rem)/2_+_2rem)]"
    >
      <div className="relative aspect-[16/11] overflow-hidden">
        <Image
          src={pousada.image || '/placeholder.svg'}
          alt={pousada.name}
          fill
          sizes="320px"
          className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
        />
      </div>
      <div className="flex flex-col gap-1.5 p-5">
        <span className="text-liquen text-sm font-medium">
          {pousada.city}, {pousada.state}
        </span>
        <span className="text-h3 text-primary-foreground">{pousada.name}</span>
        <span className="text-pedra mt-1 text-sm">
          <strong className="text-primary-foreground text-xl font-semibold tabular-nums">
            {formatPrice(pousada.pricePerNight)}
          </strong>{' '}
          / diária
        </span>
      </div>
    </Link>
  )
}
