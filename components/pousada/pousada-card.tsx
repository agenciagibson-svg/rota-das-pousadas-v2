import Image from 'next/image'
import Link from 'next/link'
import { Star } from 'lucide-react'
import type { Pousada } from '@/types'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Card de pousada comparável: foto, cidade, nome, dois destaques, preço por
 * diária e "Ver detalhes" — sempre nessa ordem e na mesma altura, para o
 * viajante comparar lado a lado. O card inteiro é o link.
 */
export function PousadaCard({
  pousada,
  sizes = '(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 25vw',
  className,
}: {
  pousada: Pousada
  sizes?: string
  className?: string
}) {
  return (
    <Link
      href={`/pousada/${pousada.slug}`}
      className={cn(
        'group bg-card hover:shadow-floating flex h-full flex-col overflow-hidden rounded-3xl transition-[transform,box-shadow] duration-(--motion-fade) hover:-translate-y-1',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={pousada.image || '/placeholder.svg'}
          alt={pousada.name}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
        />
        <Badge variant="glass" size="lg" className="absolute top-3 left-3 tabular-nums">
          <Star className="fill-ipe text-ipe size-3.5" />
          {pousada.rating.toFixed(1)}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="text-muted-foreground text-sm font-medium">
          {pousada.city}, {pousada.state}
        </span>
        <h3 className="text-h3 text-foreground mt-1">{pousada.name}</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pousada.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="secondary" size="md">
              {t}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="text-muted-foreground text-sm">
            <span className="text-foreground text-lg font-semibold tabular-nums">
              {formatPrice(pousada.pricePerNight)}
            </span>{' '}
            / diária
          </span>
          <span
            className={cn(
              buttonVariants({ size: 'pill-sm' }),
              'group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-(--motion-hover)',
            )}
          >
            Ver detalhes
          </span>
        </div>
      </div>
    </Link>
  )
}
