'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { grantAccessAction, revokeAccessAction } from '../actions'
import type { PlatformAccessGrant } from '../types'

const MAX_DAYS = 7

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** `datetime-local` não tem timezone — o valor é lido como hora LOCAL do navegador, que é a intenção (o admin pensa "daqui a X horas", não em UTC). */
function defaultExpiresAt(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Tela que faltava (achado da auditoria de 16/09/2026): `grantAccessAction`/
 * `revokeAccessAction` existiam desde a 0047 (RPC + service + action), sem
 * nenhuma tela que os chamasse. Acesso é sempre PRÓPRIO — a RPC
 * `grant_platform_access` grava `granted_to = auth.uid()` no banco; não dá
 * pra conceder acesso a outra pessoa por aqui.
 */
export function PousadaAccessGrants({
  pousadaId,
  initialGrants,
}: {
  pousadaId: string
  initialGrants: PlatformAccessGrant[]
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [revokingId, setRevokingId] = useState<string | null>(null)

  function submitGrant() {
    setError(null)
    startTransition(async () => {
      const result = await grantAccessAction({
        pousadaId,
        reason,
        expiresAt: new Date(expiresAt).toISOString(),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReason('')
      setExpiresAt(defaultExpiresAt())
      router.refresh()
    })
  }

  function revoke(id: string) {
    setError(null)
    setRevokingId(id)
    startTransition(async () => {
      const result = await revokeAccessAction({ id })
      setRevokingId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border p-4">
        <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
          <ShieldCheck className="size-4 text-ocean" />
          Solicitar acesso temporário
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Dá a você (master) acesso a reservas, pagamentos e despesas desta pousada por um período
          justificado — no máximo {MAX_DAYS} dias. Fica registrado em auditoria.
        </p>
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Motivo do acesso (mínimo 10 caracteres)..."
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-3.5" />
              Expira em
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-lg border border-input bg-card px-2 py-1 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            <Button type="button" size="sm" disabled={isPending} onClick={submitGrant}>
              {isPending && !revokingId ? 'Enviando…' : 'Solicitar acesso'}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-foreground">Concessões ativas</h3>
        {initialGrants.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma concessão ativa para esta pousada.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {initialGrants.map((grant) => (
              <div
                key={grant.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{grant.reason}</p>
                  <p className="text-xs text-muted-foreground">Expira em {fmtDateTime(grant.expiresAt)}</p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => revoke(grant.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  {isPending && revokingId === grant.id ? 'Revogando…' : 'Revogar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  )
}
