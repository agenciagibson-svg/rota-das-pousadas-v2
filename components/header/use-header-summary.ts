'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import type { HeaderSummary } from '@/features/auth/header-summary'

/**
 * Resumo do usuário logado, guardado fora do componente.
 *
 * Cada página monta o próprio `SiteHeader`; antes, cada montagem começava do
 * zero e o card do usuário sumia a cada troca de página até a busca voltar.
 * Agora a página nova já nasce com o último resumo conhecido e a busca só
 * atualiza por trás. Falha passageira da busca (rede, função fria logo depois
 * de um deploy) não apaga quem já estava logado.
 */
let cached: HeaderSummary | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function setHeaderSummary(next: HeaderSummary | null) {
  cached = next
  emit()
}

/** Resultado de uma busca: resposta boa substitui; falha só vale se ainda não há nada. */
export function applyHeaderFetch(
  current: HeaderSummary | null,
  result: { ok: true; data: HeaderSummary } | { ok: false },
): HeaderSummary {
  if (result.ok) return result.data
  return current ?? { user: null }
}

/** Ao sair da conta: o card some na hora, sem esperar a próxima busca. */
export function clearHeaderSummary() {
  setHeaderSummary({ user: null })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => cached
const getServerSnapshot = () => null

/** Busca o resumo do usuário logado; refaz a cada troca de página. */
export function useHeaderSummary(): { summary: HeaderSummary | null; loading: boolean } {
  const pathname = usePathname()
  const summary = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    let alive = true
    fetch('/api/me/header', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) =>
        r.ok
          ? { ok: true as const, data: (await r.json()) as HeaderSummary }
          : { ok: false as const },
      )
      .catch(() => ({ ok: false as const }))
      .then((result) => {
        if (alive) setHeaderSummary(applyHeaderFetch(cached, result))
      })
    return () => {
      alive = false
    }
  }, [pathname])

  return { summary, loading: summary === null }
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
