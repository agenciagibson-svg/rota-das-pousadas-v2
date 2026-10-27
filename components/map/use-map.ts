'use client'

import { useEffect, useRef, useState } from 'react'
import type { CreateMapOptions, MapLibreMap } from './maplibre'

export type MapLib = typeof import('./maplibre')

export type MapState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; map: MapLibreMap; lib: MapLib }

type UseMapOptions = Omit<CreateMapOptions, 'container'> & {
  /** Só carrega o MapLibre quando o mapa chega perto da tela (página longa). */
  lazy?: boolean
}

/**
 * Cria um mapa MapLibre dentro do `containerRef`, carregando a biblioteca com
 * `import()` só no navegador. As opções valem na criação (câmera inicial);
 * mudanças depois ficam com quem usa o `map` devolvido.
 *
 * Sem WebGL2 (navegador antigo, aceleração desligada) o construtor lança e o
 * estado vira `error` — a tela mostra um aviso e os links externos de rota
 * continuam funcionando.
 */
export function useMap(options: UseMapOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initial = useRef(options)
  const [state, setState] = useState<MapState>({ status: 'loading' })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const { lazy, ...createOptions } = initial.current
    let cancelled = false
    let map: MapLibreMap | null = null
    let observer: IntersectionObserver | null = null

    async function start(el: HTMLElement) {
      try {
        const lib = await import('./maplibre')
        if (cancelled) return
        const created = lib.createMap({ ...createOptions, container: el })
        map = created
        // Estilo que não carrega (rede/CSP) deixaria um quadro cinza mudo.
        // Erro de um tile isolado, com o estilo já carregado, não derruba o mapa.
        created.on('error', () => {
          if (!cancelled && !created.isStyleLoaded()) setState({ status: 'error' })
        })
        setState({ status: 'ready', map: created, lib })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }

    if (lazy && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect()
            void start(container)
          }
        },
        { rootMargin: '200px' },
      )
      observer.observe(container)
    } else {
      void start(container)
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      map?.remove()
    }
  }, [])

  return { containerRef, state }
}
