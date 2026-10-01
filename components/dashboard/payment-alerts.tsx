'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolvePaymentReviewAction } from '@/features/pagamentos/actions'
import { PAYMENT_REVIEW_TEXT, type PaymentReviewKind } from '@/features/pagamentos/pix'

type Review = {
  id: string
  bookingId: string
  bookingCode: string | null
  kind: PaymentReviewKind
  amount: number
  createdAt: string
}

type OpenProof = {
  bookingId: string
  bookingCode: string | null
  amount: number
  dueAt: string | null
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const when = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

/**
 * Visão geral: dinheiro que precisa de uma pessoa (0082) — comprovantes Pix
 * esperando análise (com prazo) e casos da fila "Pagamentos para revisar".
 */
export function PaymentAlerts({
  reviews,
  openProofs,
  canResolve,
}: {
  reviews: Review[]
  openProofs: OpenProof[]
  canResolve: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (reviews.length === 0 && openProofs.length === 0) return null

  async function resolve(reviewId: string) {
    setError(null)
    setBusy(true)
    try {
      const result = await resolvePaymentReviewAction({ reviewId, resolution: note })
      if (!result.ok) {
        setError(result.fieldErrors?.resolution ?? result.error)
        return
      }
      setOpen(null)
      setNote('')
      router.refresh()
    } catch {
      setError('Não foi possível salvar agora. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 space-y-3">
      {openProofs.length > 0 && (
        <section
          aria-labelledby="pix-pendentes"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4"
        >
          <h2 id="pix-pendentes" className="flex items-center gap-2 font-semibold text-amber-950">
            <Clock className="size-4" />
            {openProofs.length === 1
              ? '1 comprovante Pix para aprovar'
              : `${openProofs.length} comprovantes Pix para aprovar`}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {openProofs.map((p) => (
              <li key={p.bookingId}>
                <Link
                  href={`/dashboard/reservas/${p.bookingId}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  Reserva {p.bookingCode ?? ''}
                </Link>{' '}
                · {brl(p.amount)}
                {p.dueAt && <> · analise até {when(p.dueAt)}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length > 0 && (
        <section
          aria-labelledby="pagamentos-revisar"
          className="border-destructive/30 bg-destructive/5 rounded-2xl border p-4"
        >
          <h2
            id="pagamentos-revisar"
            className="text-destructive flex items-center gap-2 font-semibold"
          >
            <AlertTriangle className="size-4" />
            Pagamentos para revisar ({reviews.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => {
              const info = PAYMENT_REVIEW_TEXT[r.kind]
              return (
                <li key={r.id} className="bg-card border-border rounded-xl border p-3 text-sm">
                  <p className="font-semibold">{info.title}</p>
                  <p className="text-muted-foreground mt-0.5">
                    <Link
                      href={`/dashboard/reservas/${r.bookingId}`}
                      className="text-foreground font-medium underline-offset-2 hover:underline"
                    >
                      Reserva {r.bookingCode ?? ''}
                    </Link>{' '}
                    · {brl(r.amount)} · {when(r.createdAt)}
                  </p>
                  <p className="mt-1">{info.action}</p>
                  {canResolve &&
                    (open === r.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={500}
                          rows={2}
                          aria-label="O que foi feito"
                          placeholder="O que foi feito? Ex.: valor devolvido por Pix em 02/10."
                          className="border-input bg-card focus-visible:ring-ring w-full rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" disabled={busy} onClick={() => void resolve(r.id)}>
                            {busy ? 'Salvando…' : 'Marcar como resolvido'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setOpen(null)}
                          >
                            Voltar
                          </Button>
                        </div>
                        {error && (
                          <p role="alert" className="text-destructive text-sm font-medium">
                            {error}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3"
                        onClick={() => {
                          setOpen(r.id)
                          setNote('')
                          setError(null)
                        }}
                      >
                        Resolver
                      </Button>
                    ))}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
