import { Navigation, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { BlogPlace } from '../types'
import { PLACE_KIND_LABEL, PlaceIcon } from './place-icon'

/** Rota no app de mapas do celular (Google Maps abre o app quando instalado). */
export function directionsHref(place: BlogPlace): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.point.lat},${place.point.lng}`
}

/** Cartão sobre o mapa do guia com o ponto escolhido. */
export function PlaceCard({ place, onClose }: { place: BlogPlace; onClose: () => void }) {
  return (
    <Card
      radius="3xl"
      className="shadow-floating absolute inset-x-3 bottom-3 flex gap-3 p-4 sm:right-auto sm:w-96"
    >
      <span className="bg-muted text-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl">
        <PlaceIcon kind={place.kind} className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          {PLACE_KIND_LABEL[place.kind]}
          {place.approximate && ' · ponto aproximado'}
        </span>
        <span className="text-foreground font-semibold">{place.name}</span>
        {place.note && <span className="text-muted-foreground text-sm">{place.note}</span>}
        <a
          href={directionsHref(place)}
          target="_blank"
          rel="noopener"
          className={cn(buttonVariants({ size: 'pill-sm', variant: 'outline' }), 'mt-2 w-fit')}
        >
          <Navigation className="size-4" aria-hidden />
          Como chegar
        </a>
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
