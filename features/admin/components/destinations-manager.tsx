'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DestinationForm } from './destination-form'
import { deleteDestinationAction } from '../actions'
import type { AdminDestinationRow } from '../types'

const SEASON_LABEL: Record<string, string> = {
  verao: 'Verão',
  outono: 'Outono',
  inverno: 'Inverno',
  primavera: 'Primavera',
}

/**
 * Tela "Destinos" (achado da avaliação de 19/09/2026: catálogo era só
 * leitura, sem nenhuma tela/RPC de criar/editar/excluir — a home sempre
 * mostrou "0 pousadas" pra todo destino porque nada nunca populava a
 * contagem). `pousadasCount` aqui já vem calculado ao vivo pelo service.
 */
export function DestinationsManager({
  items,
  canManage,
}: {
  items: AdminDestinationRow[]
  /** `destination:manage` (comercial/marketing/master) — mostra criar/editar/excluir. */
  canManage: boolean
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function remove(id: string) {
    setError(null)
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteDestinationAction({ id })
      setDeletingId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {canManage && !creating && !editingId && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setCreating(true)
              setEditingId(null)
            }}
          >
            <Plus className="mr-1.5 size-4" />
            Novo destino
          </Button>
        </div>
      )}

      {creating && (
        <DestinationForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      )}

      {items.length === 0 && !creating && (
        <p className="text-muted-foreground text-sm">Nenhum destino cadastrado ainda.</p>
      )}

      <div className="space-y-2">
        {items.map((d) =>
          editingId === d.id ? (
            <DestinationForm
              key={d.id}
              initial={d}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={d.id}
              className="bg-secondary/50 flex items-center justify-between gap-3 rounded-xl p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground truncate font-medium">{d.name}</span>
                  <span className="text-muted-foreground text-xs">/{d.slug}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" /> {d.state}
                  </span>
                  <span>{d.pousadasCount} pousada(s) publicada(s)</span>
                  <span className="flex items-center gap-1">
                    <Star className="fill-gold text-gold size-3" /> {d.rating.toFixed(1)}
                  </span>
                  <span>A partir de R$ {d.priceFrom}</span>
                  {d.season.length > 0 && (
                    <span>{d.season.map((s) => SEASON_LABEL[s]).join(', ')}</span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(d.id)
                      setCreating(false)
                    }}
                    className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={isPending && deletingId === d.id}
                    onClick={() => remove(d.id)}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    {isPending && deletingId === d.id ? 'Excluindo…' : 'Excluir'}
                  </button>
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
    </div>
  )
}
