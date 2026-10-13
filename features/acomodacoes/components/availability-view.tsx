'use client'

import { useState, type FormEvent } from 'react'
import { Search, SearchX } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { AcomodacoesTabs } from './acomodacoes-tabs'
import { AVAILABILITY_REASON_LABEL } from './status-labels'
import { checkAvailabilityAction } from '../actions'
import type { AccommodationCategory, AvailabilityResult } from '../types'

export function AvailabilityView({
  displayName,
  pousadaName,
  categories,
}: {
  displayName: string
  pousadaName: string
  categories: AccommodationCategory[]
}) {
  const [results, setResults] = useState<AvailabilityResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [queried, setQueried] = useState<string | null>(null)

  // onSubmit (não `action`): com `<form action>` o React 19 limpa o formulário
  // depois do envio e a pessoa perdia de vista quais datas consultou.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    setPending(true)
    const result = await checkAvailabilityAction({
      checkin: String(formData.get('checkin') ?? ''),
      checkout: String(formData.get('checkout') ?? ''),
      adults: Number(formData.get('adults') ?? 1),
      children: Number(formData.get('children') ?? 0),
      pets: formData.get('pets') === 'on',
      categoryId: String(formData.get('categoryId') ?? ''),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      setResults(null)
      return
    }
    setResults(result.data)
    const fmt = (v: FormDataEntryValue | null) =>
      String(v ?? '')
        .split('-')
        .reverse()
        .join('/')
    setQueried(`${fmt(formData.get('checkin'))} → ${fmt(formData.get('checkout'))}`)
  }

  const available = results?.filter((r) => r.available) ?? []
  const unavailable = results?.filter((r) => !r.available) ?? []

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Disponibilidade"
      subtitle="Veja quais acomodações estão livres num período antes de fechar com o hóspede."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <AcomodacoesTabs active="disponibilidade" />

      <div className="mt-5 space-y-5">
        <Card className="p-5">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <Input
              label="Entrada"
              name="checkin"
              type="date"
              required
              wrapperClassName="sm:col-span-1"
            />
            <Input
              label="Saída"
              name="checkout"
              type="date"
              required
              wrapperClassName="sm:col-span-1"
            />
            <Input
              label="Adultos"
              name="adults"
              type="number"
              min={1}
              defaultValue={2}
              wrapperClassName="sm:col-span-1"
            />
            <Input
              label="Crianças"
              name="children"
              type="number"
              min={0}
              defaultValue={0}
              wrapperClassName="sm:col-span-1"
            />
            <label className="flex flex-col justify-end gap-1.5 sm:col-span-1">
              <span className="text-foreground text-sm font-medium">Pets</span>
              <span className="border-input bg-card flex h-[42px] items-center gap-2 rounded-xl border px-3.5 text-sm">
                <input type="checkbox" name="pets" /> Com pet
              </span>
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-foreground text-sm font-medium">Categoria</span>
              <select
                name="categoryId"
                className="border-input bg-card text-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-3 xl:col-span-6">
              <Button type="submit" disabled={pending}>
                <Search className="size-4" />
                {pending ? 'Consultando…' : 'Consultar'}
              </Button>
            </div>
          </form>
          {error && <p className="text-destructive mt-3 text-sm font-medium">{error}</p>}
        </Card>

        {results !== null && queried && (
          <p className="text-muted-foreground text-sm">
            Resultado para <strong className="text-foreground">{queried}</strong>
          </p>
        )}
        {results !== null && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-foreground font-semibold">Disponíveis ({available.length})</h2>
              {available.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Nenhuma disponível"
                  description="Nenhuma acomodação livre para esses critérios."
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {available.map((r) => (
                    <div
                      key={r.roomId}
                      className="border-border flex items-center justify-between rounded-xl border p-3"
                    >
                      <div>
                        <div className="text-foreground font-medium">{r.roomName}</div>
                        <div className="text-muted-foreground text-xs">
                          {r.categoryName ?? 'Sem categoria'} · até {r.capacity}
                        </div>
                      </div>
                      <Badge variant="primarySoft" size="sm">
                        Disponível
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-foreground font-semibold">
                Indisponíveis ({unavailable.length})
              </h2>
              {unavailable.length === 0 ? (
                <p className="text-muted-foreground mt-3 text-sm">
                  Nenhuma indisponibilidade encontrada.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {unavailable.map((r) => (
                    <div key={r.roomId} className="border-border rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-foreground font-medium">{r.roomName}</div>
                        <Badge variant="destructiveSoft" size="sm">
                          Indisponível
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.reasons.map((reason) => (
                          <Badge key={reason} variant="secondary" size="sm">
                            {AVAILABILITY_REASON_LABEL[reason]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
