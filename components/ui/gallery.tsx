'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Modal } from './modal'
import { cn } from '@/lib/utils'

export type GalleryImage = { src: string; alt: string }

/** Responsive image grid with an accessible lightbox (prev/next/close). */
export function Gallery({ images, className }: { images: GalleryImage[]; className?: string }) {
  const [index, setIndex] = useState<number | null>(null)
  const go = (delta: number) =>
    setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length))

  return (
    <>
      <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)}>
        {images.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            onClick={() => setIndex(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-2xl"
            aria-label={`Abrir imagem: ${img.alt}`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Modal
        open={index !== null}
        onClose={() => setIndex(null)}
        className="max-w-4xl border-0 bg-transparent p-0 shadow-none"
      >
        {index !== null && (
          <div className="relative">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-stone-deep">
              <Image src={images[index].src} alt={images[index].alt} fill sizes="90vw" className="object-contain" />
            </div>
            <button
              onClick={() => setIndex(null)}
              aria-label="Fechar"
              className="glass absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-foreground"
            >
              <X className="size-5" />
            </button>
            <button
              onClick={() => go(-1)}
              aria-label="Imagem anterior"
              className="glass absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-foreground"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Próxima imagem"
              className="glass absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-foreground"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="glass absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium text-foreground">
              {index + 1} / {images.length}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
