'use client'

import { useState } from 'react'
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

  async function onSubmit(formData: FormData) {
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
  }

  const available = results?.filter((r) => r.available) ?? []
  const unavailable = results?.filter((r) => !r.available) ?? []

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Disponibilidade"
      subtitle="Consulta operacional por período — o mapa completo de reservas vem no próximo ciclo."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <AcomodacoesTabs active="disponibilidade" />

      <div className="mt-5 space-y-5">
        <Card className="p-5">
          <form action={onSubmit} className="grid gap-4 sm:grid-cols-6">
            <Input label="Entrada" name="checkin" type="date" required wrapperClassName="sm:col-span-1" />
            <Input label="Saída" name="checkout" type="date" required wrapperClassName="sm:col-span-1" />
            <Input label="Adultos" name="adults" type="number" min={1} defaultValue={2} wrapperClassName="sm:col-span-1" />
            <Input label="Crianças" name="children" type="number" min={0} defaultValue={0} wrapperClassName="sm:col-span-1" />
            <label className="flex flex-col justify-end gap-1.5 sm:col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pets</span>
              <span className="flex h-[42px] items-center gap-2 rounded-xl border border-input bg-card px-3.5 text-sm">
                <input type="checkbox" name="pets" /> Com pet
              </span>
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria</span>
              <select name="categoryId" className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none">
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-6">
              <Button type="submit" disabled={pending}>
                <Search className="size-4" />
                {pending ? 'Consultando…' : 'Consultar'}
              </Button>
            </div>
          </form>
          {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        </Card>

        {results !== null && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="font-semibold text-foreground">Disponíveis ({available.length})</h2>
              {available.length === 0 ? (
                <EmptyState icon={SearchX} title="Nenhuma disponível" description="Nenhuma acomodação livre para esses critérios." />
              ) : (
                <div className="mt-3 space-y-2">
                  {available.map((r) => (
                    <div key={r.roomId} className="flex items-center justify-between rounded-xl border border-border p-3">
                      <div>
                        <div className="font-medium text-foreground">{r.roomName}</div>
                        <div className="text-xs text-muted-foreground">{r.categoryName ?? 'Sem categoria'} · até {r.capacity}</div>
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
              <h2 className="font-semibold text-foreground">Indisponíveis ({unavailable.length})</h2>
              {unavailable.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhuma indisponibilidade encontrada.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {unavailable.map((r) => (
                    <div key={r.roomId} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-foreground">{r.roomName}</div>
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
