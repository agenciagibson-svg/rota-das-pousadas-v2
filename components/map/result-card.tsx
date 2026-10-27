import Image from 'next/image'
import Link from 'next/link'
import { X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GeoPoint } from '@/types'

/** Pousada do resultado da busca que tem ponto no mapa. */
export type MapResult = {
  slug: string
  name: string
  city: string
  state: string
  image: string
  /** "A partir de" — o mesmo preço do card da lista (0 = sem preço). */
  price: number
  href: string
  point: GeoPoint
}

/** Cartão sobre o mapa da busca com a pousada escolhida. */
export function ResultCard({ result, onClose }: { result: MapResult; onClose: () => void }) {
  return (
    <Card
      radius="3xl"
      className="shadow-floating absolute inset-x-3 bottom-3 flex gap-3 p-3 sm:right-auto sm:w-96"
    >
      <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-2xl">
        <Image
          src={result.image || '/placeholder.svg'}
          alt={result.name}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground truncate text-xs font-medium">
          {result.city}, {result.state}
        </span>
        <span className="text-foreground truncate font-semibold">{result.name}</span>
        {result.price > 0 && (
          <span className="text-muted-foreground text-sm">
            a partir de{' '}
            <span className="text-foreground font-semibold tabular-nums">
              {formatPrice(result.price)}
            </span>{' '}
            / diária
          </span>
        )}
        <Link
          href={result.href}
          className={cn(buttonVariants({ size: 'pill-sm' }), 'mt-auto w-fit')}
        >
          Ver pousada
        </Link>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Fechar"
        onClick={onClose}
        className="shrink-0"
      >
        <X className="size-4" />
      </Button>
    </Card>
  )
}
