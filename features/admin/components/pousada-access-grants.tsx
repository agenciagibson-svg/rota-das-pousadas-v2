'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { grantAccessAction, revokeAccessAction } from '../actions'
import type { PlatformAccessGrant } from '../types'
import { formatDateTime } from '@/lib/format'

const MAX_DAYS = 7

/** Data e hora no fuso de Brasília (igual no servidor e no navegador). */
function fmtDateTime(iso: string): string {
  return formatDateTime(iso)
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
      <div className="border-border rounded-2xl border p-4">
        <h3 className="text-foreground flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="text-ocean size-4" />
          Solicitar acesso temporário
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Dá a você (master) acesso a reservas, pagamentos e despesas desta pousada por um período
          justificado — no máximo {MAX_DAYS} dias. Fica registrado em auditoria.
        </p>
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Motivo do acesso (mínimo 10 caracteres)..."
            className="border-border bg-card text-foreground focus:border-primary w-full resize-none rounded-xl border px-3 py-2 text-sm transition outline-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              <Clock className="size-3.5" />
              Expira em
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="border-input bg-card text-foreground focus:border-ring rounded-lg border px-2 py-1 text-sm outline-none"
              />
            </label>
            <Button type="button" size="sm" disabled={isPending} onClick={submitGrant}>
              {isPending && !revokingId ? 'Enviando…' : 'Solicitar acesso'}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-foreground font-semibold">Concessões ativas</h3>
        {initialGrants.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nenhuma concessão ativa para esta pousada.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {initialGrants.map((grant) => (
              <div
                key={grant.id}
                className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm">{grant.reason}</p>
                  <p className="text-muted-foreground text-xs">
                    Expira em {fmtDateTime(grant.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => revoke(grant.id)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  {isPending && revokingId === grant.id ? 'Revogando…' : 'Revogar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  )
}
