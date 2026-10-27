'use client'

import { useEffect, useState } from 'react'
import type { PriceCalendarDay } from '../price-calendar'

type Loaded = Record<string, PriceCalendarDay[]>

/** Chave de cache: os preços mudam com hóspedes e acomodação, não só com o mês. */
function cacheKey(month: string, guests: number, roomId?: string) {
  return `${month}|${guests}|${roomId ?? ''}`
}

/**
 * Busca as noites de um mês na rota `/pousada/[slug]/calendario` (que chama a
 * RPC pública da 0094 pelo servidor). Guarda cada mês já visto para que a
 * escolha da saída possa atravessar a virada do mês sem nova busca.
 */
export function usePriceCalendar({
  slug,
  month,
  guests,
  roomId,
}: {
  slug: string
  month: string
  guests: number
  roomId?: string
}): { days: Record<string, PriceCalendarDay>; loading: boolean; failed: boolean } {
  const [loaded, setLoaded] = useState<Loaded>({})
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const key = cacheKey(month, guests, roomId)
  const has = key in loaded

  useEffect(() => {
    if (has) return
    const controller = new AbortController()
    const params = new URLSearchParams({ mes: month, hospedes: String(guests) })
    if (roomId) params.set('quarto', roomId)
    fetch(`/pousada/${encodeURIComponent(slug)}/calendario?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        const body = (await response.json()) as { days?: PriceCalendarDay[] }
        setLoaded((current) => ({ ...current, [key]: body.days ?? [] }))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setFailedKey(key)
      })
    return () => controller.abort()
  }, [has, key, month, guests, roomId, slug])

  // Todas as noites já carregadas para estes hóspedes e esta acomodação.
  const suffix = `|${guests}|${roomId ?? ''}`
  const days: Record<string, PriceCalendarDay> = {}
  for (const [k, rows] of Object.entries(loaded)) {
    if (!k.endsWith(suffix)) continue
    for (const row of rows) days[row.date] = row
  }
  const failed = failedKey === key && !has
  return { days, loading: !has && !failed, failed }
}
