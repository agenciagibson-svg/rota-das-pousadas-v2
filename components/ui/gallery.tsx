'use client'

import { useEffect, useState, type UIEvent } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Modal } from './modal'
import { cn } from '@/lib/utils'

export type GalleryImage = { src: string; alt: string }

/** Lugar de cada foto no mosaico 4×2, sem buracos quando há menos de 5 fotos. */
function mosaicTile(total: number, i: number): string {
  const n = Math.min(total, 5)
  if (i === 0) return n === 1 ? 'col-span-4 row-span-2' : 'col-span-2 row-span-2'
  if (n === 2) return 'col-span-2 row-span-2'
  if (n === 3 || (n === 4 && i === 1)) return 'col-span-2'
  return ''
}

/**
 * Galeria de fotos com lightbox acessível (anterior/próxima/fechar).
 *
 * `layout="grid"`: grade simples. `layout="hero"`: a foto como protagonista da
 * página — no celular, faixa de tela cheia que desliza com o dedo e mostra
 * "1 de 5"; do tablet para cima, mosaico com a primeira foto grande e até
 * quatro menores. Qualquer foto abre o lightbox.
 */
export function Gallery({
  images,
  className,
  layout = 'grid',
  priority = false,
}: {
  images: GalleryImage[]
  className?: string
  layout?: 'grid' | 'hero'
  priority?: boolean
}) {
  const [index, setIndex] = useState<number | null>(null)
  const [visible, setVisible] = useState(0)
  const go = (delta: number) =>
    setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length))

  // Setas do teclado trocam a foto com a galeria aberta.
  const lightboxOpen = index !== null
  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` só usa setState funcional
  }, [lightboxOpen, images.length])

  function onStripScroll(event: UIEvent<HTMLDivElement>) {
    const el = event.currentTarget
    setVisible(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }

  return (
    <>
      {layout === 'grid' ? (
        <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)}>
          {images.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl"
              aria-label={`Abrir imagem: ${img.alt}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className={cn('relative', className)}>
          {/* Celular: faixa que desliza */}
          <div
            onScroll={onStripScroll}
            className="flex h-[62svh] min-h-96 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto md:hidden"
          >
            {images.map((img, i) => (
              <button
                key={`${img.src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className="relative h-full w-full shrink-0 snap-center"
                aria-label={`Abrir foto ${i + 1} de ${images.length}`}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="100vw"
                  priority={priority && i === 0}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
          <span className="glass-dark text-primary-foreground pointer-events-none absolute right-4 bottom-10 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums md:hidden">
            {visible + 1} de {images.length}
          </span>

          {/* Tablet e desktop: mosaico */}
          <div className="hidden h-[min(64vh,36rem)] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl md:grid">
            {images.slice(0, 5).map((img, i) => (
              <button
                key={`${img.src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={cn('group relative overflow-hidden', mosaicTile(images.length, i))}
                aria-label={`Abrir foto ${i + 1} de ${images.length}`}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes={i === 0 ? '50vw' : '25vw'}
                  priority={priority && i === 0}
                  className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                />
                {i === 4 && images.length > 5 && (
                  <span className="glass-dark text-primary-foreground absolute right-3 bottom-3 rounded-full border px-3 py-1.5 text-sm font-semibold">
                    +{images.length - 5} fotos
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={index !== null}
        onClose={() => setIndex(null)}
        label={index !== null ? images[index].alt : undefined}
        className="max-w-5xl border-0 bg-transparent p-0 shadow-none"
      >
        {index !== null && (
          <div className="relative">
            <div className="bg-breu relative aspect-[16/10] w-full overflow-hidden rounded-3xl">
              <Image
                src={images[index].src}
                alt={images[index].alt}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => setIndex(null)}
              aria-label="Fechar"
              className="glass text-foreground absolute top-3 right-3 flex size-11 items-center justify-center rounded-full"
            >
              <X className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Imagem anterior"
              className="glass text-foreground absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima imagem"
              className="glass text-foreground absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full"
            >
              <ChevronRight className="size-5" />
            </button>
            <div
              aria-live="polite"
              className="glass text-foreground absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-medium tabular-nums"
            >
              {index + 1} / {images.length}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
