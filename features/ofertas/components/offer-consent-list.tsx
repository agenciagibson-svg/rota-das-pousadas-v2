'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setOfferConsentAction } from '../actions'
import type { OfferConsent } from '@/repositories/offers.repository'

/** Uma linha por pousada: receber ou parar de receber ofertas (0111). */
export function OfferConsentList({ consents }: { consents: OfferConsent[] }) {
  const [rows, setRows] = useState(consents)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(pousadaId: string, granted: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await setOfferConsentAction({ pousadaId, granted })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setRows((all) => all.map((r) => (r.pousadaId === pousadaId ? { ...r, granted } : r)))
    })
  }

  return (
    <>
      <ul className="divide-border divide-y">
        {rows.map((r) => (
          <li key={r.pousadaId} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <Link
                href={`/pousada/${r.pousadaSlug}`}
                className="text-foreground block truncate font-semibold hover:underline"
              >
                {r.pousadaName}
              </Link>
              <span className="text-muted-foreground text-xs">
                {r.granted ? 'Recebendo ofertas' : 'Sem ofertas'}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={r.granted ? 'outline' : 'default'}
              disabled={pending}
              onClick={() => toggle(r.pousadaId, !r.granted)}
            >
              {r.granted ? 'Parar de receber' : 'Voltar a receber'}
            </Button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-destructive mt-2 text-sm font-medium">
          {error}
        </p>
      )}
    </>
  )
}
