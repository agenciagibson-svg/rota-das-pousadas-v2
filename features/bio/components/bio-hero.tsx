import Image from 'next/image'
import { Images, Star } from 'lucide-react'
import { Marker } from '@/components/brand/logo'

/**
 * Topo da página da bio: as fotos da pousada em carrossel de deslizar (só CSS,
 * `scroll-snap` — nenhum JavaScript, para abrir rápido no navegador do
 * Instagram) com nome, cidade e nota por cima. É a continuação da foto que a
 * pessoa acabou de ver no Instagram: confiança antes de pedir data.
 */
export function BioHero({
  name,
  city,
  state,
  photos,
  rating,
  reviews,
}: {
  name: string
  city: string
  state: string
  photos: string[]
  rating: number
  reviews: number
}) {
  const shown = photos.slice(0, 8)
  return (
    <section aria-label={`Fotos e apresentação da ${name}`} className="relative -mx-5 -mt-8">
      {shown.length > 0 ? (
        <div
          tabIndex={0}
          aria-label={
            shown.length > 1 ? 'Fotos da pousada — deslize para o lado' : 'Foto da pousada'
          }
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto rounded-b-3xl [&::-webkit-scrollbar]:hidden"
        >
          {shown.map((src, i) => (
            <div key={src} className="relative aspect-[4/5] w-full shrink-0 snap-center">
              <Image
                src={src}
                alt={`${name} — foto ${i + 1} de ${shown.length}`}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
                sizes="(max-width: 448px) 100vw, 448px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-primary aspect-[4/3] rounded-b-3xl" />
      )}

      {/* Escurece a base da foto para o nome ficar legível. */}
      <div className="from-breu/90 via-breu/30 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 rounded-b-3xl bg-gradient-to-t to-transparent" />

      {shown.length > 1 && (
        <span className="glass-dark text-primary-foreground pointer-events-none absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
          <Images className="size-4" aria-hidden />
          {shown.length} fotos · deslize
        </span>
      )}

      <div className="text-primary-foreground pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
        <p className="text-primary-foreground/85 inline-flex items-center gap-2 text-sm font-medium">
          <Marker /> {city}, {state}
        </p>
        <h1 className="text-h1 text-balance">{name}</h1>
        {reviews > 0 && rating > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm">
            <Star className="fill-accent text-accent size-4" aria-hidden />
            <span className="font-semibold tabular-nums">
              {rating.toFixed(1).replace('.', ',')}
            </span>
            <span className="text-primary-foreground/80">
              ({reviews} {reviews === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </p>
        )}
      </div>
    </section>
  )
}
