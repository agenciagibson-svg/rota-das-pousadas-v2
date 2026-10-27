'use client'

import { useEffect, useState } from 'react'
import { quoteCounterStayAction } from '@/features/acomodacoes/actions'
import type { MoveTarget } from '../occupancy'

/** Espera a pessoa parar de mexer nas datas antes de cotar. */
const DEBOUNCE_MS = 300

/**
 * Diárias do destino pelas tarifas (0087, mesma cotação da Nova reserva). Só
 * informação para o diálogo: quem grava o valor novo é a RPC, que cota de novo.
 */
export function useMoveQuote(
  target: MoveTarget,
  enabled: boolean,
): { nights: number | null; loading: boolean; failed: boolean } {
  const key = `${target.roomId}|${target.checkin}|${target.checkout}`
  const [result, setResult] = useState<{ key: string; total: number | null } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const timer = setTimeout(() => {
      quoteCounterStayAction({
        roomId: target.roomId,
        checkin: target.checkin,
        checkout: target.checkout,
      })
        .then((res) => {
          if (alive) setResult({ key, total: res.ok && res.data ? res.data.total : null })
        })
        .catch(() => alive && setResult({ key, total: null }))
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // A chave resume quarto e datas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const current = result?.key === key ? result : null
  return {
    nights: current?.total ?? null,
    loading: enabled && !current,
    failed: enabled && current !== null && current.total === null,
  }
}
