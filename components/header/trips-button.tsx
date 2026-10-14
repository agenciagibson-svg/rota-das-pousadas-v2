'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Luggage, Clock, CalendarCheck, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HeaderTrip } from '@/features/auth/header-summary'
import { timeLeft } from './use-header-summary'
import { useDismiss } from './use-dismiss'

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v)
const shortDate = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7)

/**
 * "Carrinho" do viajante: malinha com contador de reservas aguardando
 * pagamento; o painel lista cada uma com o tempo restante e "Pagar agora".
 */
export function TripsButton({
  pendingTrips,
  nextTrip,
  solid,
}: {
  pendingTrips: HeaderTrip[]
  nextTrip: HeaderTrip | null
  solid: boolean
}) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(ref, open, close)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const count = pendingTrips.length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count ? `Minhas viagens — ${count} aguardando pagamento` : 'Minhas viagens'}
        aria-expanded={open}
        aria-controls="minhas-viagens"
        className={cn(
          'relative flex size-10 items-center justify-center rounded-full border transition-colors',
          solid
            ? 'border-border bg-card text-foreground hover:bg-secondary'
            : 'border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20',
        )}
      >
        <Luggage className="size-5" />
        {count > 0 && (
          <span className="bg-accent text-accent-foreground absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-5 font-bold">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          id="minhas-viagens"
          role="region"
          aria-label="Minhas viagens"
          className="border-border bg-card absolute right-0 mt-3 w-80 overflow-hidden rounded-2xl border shadow-2xl"
        >
          <div className="border-border border-b px-4 py-3">
            <p className="font-display text-base font-medium">Minhas viagens</p>
            <p className="text-muted-foreground text-xs">
              {count ? `${count} aguardando pagamento` : 'Nada pendente por aqui'}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {pendingTrips.map((t) => {
              const left = timeLeft(t.paymentDueAt, now)
              return (
                <div key={t.id} className="border-border border-b px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.pousadaName}</p>
                      <p className="text-muted-foreground text-xs">
                        {shortDate(t.checkin)} a {shortDate(t.checkout)} · {t.code}
                      </p>
                    </div>
                    <span className="text-primary text-sm font-bold tabular-nums">
                      {brl(t.total)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {t.awaitingApproval ? (
                      <span className="bg-secondary text-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                        <Clock className="size-3" /> Pix em análise
                      </span>
                    ) : (
                      left && (
                        <span className="bg-ipe/20 text-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                          <Clock className="size-3" /> Pague em {left}
                        </span>
                      )
                    )}
                    <Link
                      href={`/pousada/${t.pousadaSlug}/reservar/${t.id}/pagamento`}
                      onClick={close}
                      className="bg-accent text-accent-foreground ml-auto rounded-full px-3 py-1.5 text-xs font-semibold hover:brightness-105"
                    >
                      {t.awaitingApproval ? 'Ver' : 'Pagar agora'}
                    </Link>
                  </div>
                </div>
              )
            })}

            {nextTrip && (
              <div className="bg-secondary/50 px-4 py-3">
                <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
                  <CalendarCheck className="size-3" /> Próxima estadia
                </p>
                <p className="text-sm font-semibold">{nextTrip.pousadaName}</p>
                <p className="text-muted-foreground text-xs">
                  {shortDate(nextTrip.checkin)} a {shortDate(nextTrip.checkout)} · {nextTrip.code}
                </p>
              </div>
            )}

            {!count && !nextTrip && (
              <div className="px-4 py-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Que tal planejar a próxima escapada?
                </p>
                <Link
                  href="/pousadas"
                  onClick={close}
                  className="text-primary mt-2 inline-block text-sm font-semibold"
                >
                  Explorar pousadas
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/minhas-reservas"
            onClick={close}
            className="border-border text-primary hover:bg-secondary flex items-center justify-center gap-1 border-t px-4 py-3 text-sm font-semibold"
          >
            Ver todas as reservas <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
