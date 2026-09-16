'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, ShieldCheck } from 'lucide-react'
import { changePousadaStatusAction } from '../actions'
import { Badge } from '@/components/ui/badge'
import type { AdminPousadaRow } from '../types'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_analise: 'Em análise',
  aprovada: 'Aprovada',
  publicada: 'Publicada',
  suspensa: 'Suspensa',
  arquivada: 'Arquivada',
  reprovada: 'Reprovada',
}

/** Só oferece a transição óbvia pro status atual — evita um seletor com 7 opções confusas. */
function nextAction(status: string): { label: string; target: string } | null {
  if (status === 'publicada') return { label: 'Suspender', target: 'suspensa' }
  if (status === 'suspensa') return { label: 'Reativar', target: 'publicada' }
  return null
}

export function PousadasTable({
  items,
  canManageGrants,
}: {
  items: AdminPousadaRow[]
  /** `platform:grant:manage` (só master) — mostra o link de acesso institucional. */
  canManageGrants: boolean
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma pousada encontrada.</p>
  }

  function run(id: string, target: string) {
    setError(null)
    setPendingId(id)
    startTransition(async () => {
      const result = await changePousadaStatusAction({ id, status: target })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {items.map((p) => {
        const action = nextAction(p.status)
        return (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">{p.name}</span>
                <Badge size="sm" variant="secondary">
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {p.city}, {p.state}
                </span>
                <span>{p.ownerName ? `Proprietário: ${p.ownerName}` : 'Sem proprietário vinculado'}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canManageGrants && (
                <Link
                  href={`/admin/pousadas/${p.id}/acessos`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  <ShieldCheck className="size-3.5" />
                  Acessos
                </Link>
              )}
              {action && (
                <button
                  disabled={isPending && pendingId === p.id}
                  onClick={() => run(p.id, action.target)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {action.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
