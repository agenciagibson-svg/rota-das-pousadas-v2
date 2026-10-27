'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { previewCouponAction } from '../actions'
import { couponRejectionMessage, normalizeCouponCode } from '../discount'
import type { CouponPreview } from '../types'

type Applied = Extract<CouponPreview, { ok: true }>

export type CouponState = {
  open: boolean
  setOpen: (open: boolean) => void
  code: string
  setCode: (code: string) => void
  /** Cupom aplicado às datas e acomodação que estão na tela agora (ou null). */
  applied: Applied | null
  error: string | null
  applying: boolean
  /** Há código digitado que ainda não foi aplicado. */
  pendingCode: boolean
  canApply: boolean
  apply: () => Promise<void>
  remove: () => void
  /** Recalcula o cupom aplicado (ex.: depois de a reserva recusar o valor). */
  refresh: () => Promise<void>
}

/**
 * Estado do campo "Tenho um cupom" na reserva (0100). O desconto vem SEMPRE
 * do banco (`preview_booking_coupon`); a tela só mostra. Ao mudar datas ou
 * acomodação, um cupom já aplicado é recalculado sozinho — e um código vindo
 * da bio (`?cupom=`) é aplicado uma vez assim que houver valor na tela.
 */
export function useCoupon({
  roomId,
  checkin,
  checkout,
  ready,
  initialCode,
}: {
  roomId?: string
  checkin: string
  checkout: string
  /** Há cotação do servidor para as datas da tela (sem ela, não há o que descontar). */
  ready: boolean
  initialCode?: string
}): CouponState {
  const [open, setOpen] = useState(Boolean(initialCode))
  const [code, setCodeState] = useState(initialCode ?? '')
  const [result, setResult] = useState<{ key: string; applied: Applied } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const autoApply = useRef(Boolean(initialCode))

  const key = `${roomId ?? ''}|${checkin}|${checkout}`
  const applied = result && result.key === key ? result.applied : null
  const normalized = normalizeCouponCode(code)
  const canApply = ready && Boolean(roomId) && normalized.length > 0

  const run = useCallback(
    async (target: string) => {
      if (!roomId || !target) return
      setError(null)
      setApplying(true)
      try {
        const response = await previewCouponAction({ roomId, checkin, checkout, code: target })
        if (!response.ok) {
          setResult(null)
          setError(response.error)
          return
        }
        if (!response.data.ok) {
          setResult(null)
          setError(couponRejectionMessage(response.data))
          return
        }
        setResult({ key, applied: response.data })
      } catch {
        setError('Não foi possível conferir o cupom. Confira a conexão e tente de novo.')
      } finally {
        setApplying(false)
      }
    },
    [roomId, checkin, checkout, key],
  )

  // Datas/acomodação mudaram com cupom aplicado, ou chegou o valor para o
  // código da bio: aplica (de novo) uma vez para a combinação nova.
  const lastAuto = useRef<string | null>(null)
  useEffect(() => {
    if (!ready || !roomId || lastAuto.current === key) return
    const target = result?.applied.code ?? (autoApply.current ? normalized : '')
    if (!target || (result && result.key === key)) return
    lastAuto.current = key
    autoApply.current = false
    void run(target)
  }, [ready, roomId, key, result, normalized, run])

  return {
    open,
    setOpen,
    code,
    setCode: (value: string) => {
      setCodeState(value)
      setError(null)
    },
    applied,
    error,
    applying,
    pendingCode: normalized.length > 0 && (!applied || applied.code !== normalized),
    canApply,
    apply: () => run(normalized),
    remove: () => {
      setResult(null)
      setCodeState('')
      setError(null)
      setOpen(false)
    },
    refresh: async () => {
      if (applied) await run(applied.code)
    },
  }
}
