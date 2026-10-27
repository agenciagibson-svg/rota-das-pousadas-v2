import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Alfinete da marca (Breu com ponto Ipê). Desenhado dentro do elemento do
 * marcador do MapLibre (`useMarkerElement`), com a ponta no ponto marcado.
 */
export function MapPinMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-primary text-accent shadow-floating ring-background flex size-10 items-center justify-center rounded-full ring-4',
        className,
      )}
    >
      <MapPin className="fill-accent stroke-primary size-6" strokeWidth={2} />
    </span>
  )
}
