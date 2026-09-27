'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { HeaderSummary } from '@/features/auth/header-summary'

/** Busca o resumo do usuário logado; refaz a cada troca de página. */
export function useHeaderSummary(): { summary: HeaderSummary | null; loading: boolean } {
  const pathname = usePathname()
  const [summary, setSummary] = useState<HeaderSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/me/header', { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: HeaderSummary) => {
        if (alive) setSummary(data)
      })
      .catch(() => {
        if (alive) setSummary({ user: null })
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [pathname])

  return { summary, loading }
}

/** "1h42" / "35 min" / "encerrado" — tempo até o prazo de pagamento. */
export function timeLeft(iso: string | null, now: number): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'prazo encerrado'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)} dia${h >= 48 ? 's' : ''}`
}
