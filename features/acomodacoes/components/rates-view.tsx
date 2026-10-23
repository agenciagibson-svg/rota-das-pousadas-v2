'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { AcomodacoesTabs } from './acomodacoes-tabs'
import { RateRuleForm } from './rate-rule-form'
import { deleteRateRuleAction } from '../actions'
import { describeAdjustment, describePeriod, describeWeekdays, isPastRule } from '../rates'
import type { RateRule } from '../types'

export function RatesView({
  displayName,
  pousadaName,
  rules,
  rooms,
  canManage,
  todayISO,
}: {
  displayName: string
  pousadaName: string
  rules: RateRule[]
  rooms: { id: string; name: string; basePrice?: number }[]
  canManage: boolean
  /** Hoje no fuso da pousada (para apagar regras que já passaram). */
  todayISO: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<RateRule | 'new' | null>(null)
  const [deleting, setDeleting] = useState<RateRule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ordered = [...rules].sort(
    (a, b) =>
      Number(isPastRule(a, todayISO)) - Number(isPastRule(b, todayISO)) ||
      a.firstNight.localeCompare(b.firstNight),
  )

  function confirmDelete() {
    if (!deleting) return
    const id = deleting.id
    setError(null)
    startTransition(async () => {
      const result = await deleteRateRuleAction({ id })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDeleting(null)
      router.refresh()
    })
  }

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Tarifas"
      subtitle="Preço de feriados, alta temporada e fim de semana, com estadia mínima."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="space-y-5">
        <AcomodacoesTabs active="tarifas" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground max-w-prose text-sm">
            Fora destes períodos vale a diária de cada acomodação. Quando duas regras cobrem a mesma
            noite, vence a da acomodação; depois, a de período mais curto.
          </p>
          {canManage && (
            <Button size="touch" onClick={() => setEditing('new')}>
              <Plus className="size-4" /> Nova regra
            </Button>
          )}
        </div>

        {ordered.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Nenhuma regra de tarifa"
            description="Crie uma para Carnaval, Réveillon ou fim de semana. A vitrine e a reserva pelo site passam a cobrar o novo valor."
          />
        ) : (
          <div className="space-y-3">
            {ordered.map((rule) => {
              const past = isPastRule(rule, todayISO)
              return (
                <Card
                  key={rule.id}
                  className={cn(
                    'flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between',
                    (past || !rule.active) && 'opacity-70',
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-foreground font-semibold">{rule.name}</h3>
                      {!rule.active && <Badge size="sm">Desativada</Badge>}
                      {past && <Badge size="sm">Já passou</Badge>}
                    </div>
                    <p className="text-foreground text-sm">{describeAdjustment(rule)}</p>
                    <p className="text-muted-foreground text-sm">
                      {describePeriod(rule)} · {describeWeekdays(rule.weekdays)} ·{' '}
                      {rule.roomName ?? 'Todas as acomodações'}
                      {rule.minNights ? ` · mínimo de ${rule.minNights} noites` : ''}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="touch" variant="outline" onClick={() => setEditing(rule)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button
                        size="touch"
                        variant="destructive"
                        aria-label={`Excluir ${rule.name}`}
                        onClick={() => setDeleting(rule)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nova regra de tarifa' : 'Editar regra'}
        className="max-w-xl"
      >
        {editing !== null && (
          <RateRuleForm
            rule={editing === 'new' ? undefined : editing}
            rooms={rooms}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Excluir regra?"
        description={
          deleting
            ? `"${deleting.name}" deixa de valer. Reservas já feitas mantêm o valor que foi cobrado.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" size="touch" onClick={() => setDeleting(null)}>
              Voltar
            </Button>
            <Button variant="destructive" size="touch" disabled={isPending} onClick={confirmDelete}>
              Excluir regra
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </Dialog>
    </DashboardShell>
  )
}
