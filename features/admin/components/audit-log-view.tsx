'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AuditLogEntry } from '../types'

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Trilha de auditoria da plataforma — achado da avaliação de 19/09/2026:
 * `audit_log` existe desde a migration 0001 e já registra eventos sensíveis
 * (troca de papel, vínculo de proprietário, expiração de reserva por cron,
 * etc.), mas nenhuma tela lia essa tabela. Filtro por ação (busca parcial) e
 * período; sem paginação de verdade ainda (últimos 200 eventos), suficiente
 * pro volume atual — revisar se crescer muito.
 */
export function AuditLogView({ initialEntries }: { initialEntries: AuditLogEntry[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  function applyFilter() {
    startTransition(() => {
      const params = new URLSearchParams()
      if (action.trim()) params.set('action', action.trim())
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  function clearFilter() {
    setAction('')
    setFrom('')
    setTo('')
    startTransition(() => router.push(pathname))
  }

  return (
    <div className="space-y-4">
      <div className="border-border flex flex-wrap items-end gap-3 rounded-2xl border p-4">
        <Input
          label="Ação contém"
          placeholder="ex.: member, pousada.status"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="w-56"
          disabled={isPending}
        />
        <Input
          label="De"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          disabled={isPending}
        />
        <Input
          label="Até"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={isPending}
        />
        <Button type="button" onClick={applyFilter} disabled={isPending}>
          <Search className="mr-1.5 size-4" />
          Filtrar
        </Button>
        <button
          type="button"
          onClick={clearFilter}
          disabled={isPending}
          className="text-muted-foreground text-sm hover:underline disabled:opacity-50"
        >
          Limpar
        </button>
      </div>

      {initialEntries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum evento encontrado para esse filtro.</p>
      ) : (
        <div className="space-y-2">
          {initialEntries.map((entry) => (
            <div key={entry.id} className="bg-secondary/50 rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ocean font-mono text-xs font-semibold">{entry.action}</span>
                <span className="text-muted-foreground text-xs">
                  {fmtDateTime(entry.createdAt)}
                </span>
              </div>
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span>Ator: {entry.actorName ?? 'sistema (cron)'}</span>
                {entry.targetTable && (
                  <span>
                    Alvo: {entry.targetTable}
                    {entry.targetId ? ` (${entry.targetId.slice(0, 8)}…)` : ''}
                  </span>
                )}
              </div>
              {Object.keys(entry.metadata).length > 0 && (
                <pre className="bg-background/60 text-muted-foreground mt-1.5 overflow-x-auto rounded-lg p-2 font-mono text-[11px]">
                  {JSON.stringify(entry.metadata)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
