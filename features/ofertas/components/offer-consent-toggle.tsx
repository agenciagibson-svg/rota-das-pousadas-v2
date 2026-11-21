'use client'

import { useState, useTransition } from 'react'
import { Check, Gift } from 'lucide-react'
import { setOfferConsentAction } from '../actions'
import { OFFERS_PER_POUSADA_PER_MONTH } from '../rules'

/**
 * "Quero receber ofertas desta pousada" (0111). Padrão desligado: só liga
 * quem marca. Desligar vale na hora (e no e-mail tem o link para sair).
 */
export function OfferConsentToggle({
  pousadaId,
  initial,
  className,
}: {
  pousadaId: string
  initial: boolean
  className?: string
}) {
  const [granted, setGranted] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(next: boolean) {
    setError(null)
    setGranted(next)
    startTransition(async () => {
      const res = await setOfferConsentAction({ pousadaId, granted: next })
      if (!res.ok) {
        setGranted(!next)
        setError(res.error)
      }
    })
  }

  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={granted}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span
          aria-hidden
          className="border-app-ink/30 peer-checked:bg-app-strong peer-checked:border-app-strong peer-focus-visible:ring-ipe mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition peer-focus-visible:ring-2"
        >
          {granted && <Check className="text-neblina size-4" />}
        </span>
        <span className="text-[13px] leading-snug">
          <span className="flex items-center gap-1.5 font-semibold">
            <Gift className="size-4" aria-hidden /> Quero receber ofertas desta pousada
          </span>
          <span className="text-muted-foreground mt-0.5 block">
            Descontos para você voltar, no máximo {OFFERS_PER_POUSADA_PER_MONTH} por mês. Dá para
            sair quando quiser.
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
