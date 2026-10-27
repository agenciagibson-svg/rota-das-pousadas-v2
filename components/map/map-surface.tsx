'use client'

import type { ReactNode, RefObject } from 'react'
import { MapPinOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { MapState } from './use-map'

/**
 * Moldura comum dos mapas: área do MapLibre + estados de carregando e de
 * falha (sem WebGL, estilo fora do ar). `children` fica por cima do mapa
 * (cartão da pousada selecionada, por exemplo).
 */
export function MapSurface({
  containerRef,
  state,
  label,
  className,
  children,
}: {
  containerRef: RefObject<HTMLDivElement | null>
  state: MapState
  /** Nome acessível da região do mapa. */
  label: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      role="region"
      aria-label={label}
      className={cn('bg-muted relative isolate overflow-hidden rounded-3xl', className)}
    >
      {/*
        `size-full`, não `absolute`: o CSS do MapLibre (fora das camadas do
        Tailwind, então vence) põe `position: relative` no contêiner.
      */}
      <div ref={containerRef} className="size-full" />
      {state.status === 'loading' && <Skeleton className="absolute inset-0 rounded-none" />}
      {state.status === 'error' && (
        <div
          role="status"
          className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm"
        >
          <MapPinOff className="size-6" />
          Não foi possível carregar o mapa neste navegador.
        </div>
      )}
      {children}
    </div>
  )
}
