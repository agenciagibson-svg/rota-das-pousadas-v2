'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, ShieldCheck } from 'lucide-react'
import { changePousadaStatusAction } from '../actions'
import { LinkPousadaOwner } from './link-pousada-owner'
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
  // Rascunho cadastrado pela equipe (ou aprovado/reprovado) só saía do lugar
  // pelo fluxo do dono; sem dono vinculado ficava preso.
  if (status === 'rascunho' || status === 'aprovada' || status === 'reprovada')
    return { label: 'Publicar', target: 'publicada' }
  return null
}

export function PousadasTable({
  items,
  canManageGrants,
  canLinkOwner,
}: {
  items: AdminPousadaRow[]
  /** `platform:grant:manage` (só master) — mostra o link de acesso institucional. */
  canManageGrants: boolean
  /** `pousada:link_owner` (comercial/master) — mostra o botão de vincular proprietário. */
  canLinkOwner: boolean
}) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma pousada encontrada.</p>
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
          <div
            key={p.id}
            className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-foreground truncate font-medium">{p.name}</span>
                <Badge size="sm" variant="secondary">
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </div>
              <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" /> {p.city}, {p.state}
                </span>
                {p.ownerName ? (
                  <span>
                    Proprietário: {p.ownerName}
                    {p.ownerEmail && p.ownerEmail !== p.ownerName ? ` (${p.ownerEmail})` : ''}
                  </span>
                ) : (
                  <span className="text-destructive">Sem proprietário vinculado</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canLinkOwner && !p.ownerName && <LinkPousadaOwner pousadaId={p.id} />}
              {canManageGrants && (
                <Link
                  href={`/admin/pousadas/${p.id}/acessos`}
                  className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <ShieldCheck className="size-3.5" />
                  Acessos
                </Link>
              )}
              {action && (
                <button
                  disabled={isPending && pendingId === p.id}
                  onClick={() => run(p.id, action.target)}
                  className="border-border text-foreground hover:bg-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {action.label}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
