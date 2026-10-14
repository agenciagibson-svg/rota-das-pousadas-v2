'use client'

import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  DollarSign,
  MapPin,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav } from '../admin-nav'
import { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PendingPousadas } from './pending-pousadas'
import type { PendingPousada, PlatformOverview } from '../types'

/** `bookings.fee`/`total` são guardados em reais inteiros, não centavos — ver features/reservas/pricing.ts. */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}mil`
  return `R$ ${value.toFixed(0)}`
}

function formatDelta(pct: number | null): { label: string; positive: boolean } {
  if (pct === null) return { label: '—', positive: true }
  return { label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct >= 0 }
}

export function AdminView({
  displayName,
  pending,
  canCreatePousada,
  overview,
}: {
  displayName: string
  pending: PendingPousada[]
  canCreatePousada: boolean
  overview: PlatformOverview
}) {
  const gmvDelta = formatDelta(overview.kpis.gmvDeltaPct)
  const kpis = [
    {
      label: 'Volume processado (GMV) — mês',
      value: formatCurrency(overview.kpis.gmvThisMonth),
      delta: gmvDelta,
      icon: DollarSign,
    },
    {
      label: 'Pousadas ativas',
      value: String(overview.kpis.activePousadas),
      delta: null,
      icon: Building2,
    },
    {
      label: 'Reservas no mês',
      value: String(overview.kpis.bookingsThisMonth),
      delta: null,
      icon: CheckCircle2,
    },
    {
      label: 'Novos anfitriões (mês)',
      value: String(overview.kpis.newHostsThisMonth),
      delta: null,
      icon: Users,
    },
  ]

  return (
    <DashboardShell
      nav={adminNav('overview')}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Visão geral da plataforma"
      subtitle="Métricas consolidadas de toda a rede de pousadas"
      accent="ocean"
      user={{ name: displayName, role: 'Administrador' }}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5">
              <div className="flex items-center justify-between">
                <IconBadge tone="ocean" size="md">
                  <k.icon className="size-5" />
                </IconBadge>
                {k.delta && (
                  <Badge
                    variant="primarySoft"
                    size="md"
                    className="gap-1 px-2 py-0.5 font-semibold"
                  >
                    {k.delta.positive ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    {k.delta.label}
                  </Badge>
                )}
              </div>
              <div className="text-foreground mt-4 text-2xl font-semibold">{k.value}</div>
              <div className="text-muted-foreground text-sm">{k.label}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-foreground font-display text-lg font-medium">GMV mensal</h3>
                <p className="text-muted-foreground text-sm">Últimos 12 meses</p>
              </div>
            </div>
            <div className="h-40">
              <AreaChart data={overview.gmvByMonth.map((m) => m.amount)} color="var(--ocean)" />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-foreground font-display text-lg font-medium">Taxa de ocupação</h3>
            <p className="text-muted-foreground text-sm">Aproximação da rede (mês atual)</p>
            <div className="mt-2 flex justify-center">
              <Donut value={overview.occupancyRate} color="var(--ocean)" />
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-6">
            <h3 className="text-foreground font-display text-lg font-medium">
              Reservas por região
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">Top 5 estados</p>
            <div className="h-36">
              <BarChart
                data={overview.bookingsByRegion.map((r) => r.count)}
                labels={overview.bookingsByRegion.map((r) => r.state)}
                color="var(--ocean)"
              />
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-foreground font-display text-lg font-medium">
                Aprovações pendentes
              </h3>
              <span className="bg-ocean/15 text-ocean rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {pending.length}
              </span>
            </div>
            <PendingPousadas items={pending} />
          </Card>
        </div>

        {canCreatePousada && (
          <Card className="flex items-center justify-between gap-4 p-6">
            <div>
              <h3 className="text-foreground font-display text-lg font-medium">Cadastro rápido</h3>
              <p className="text-muted-foreground text-sm">
                Cadastre uma pousada em nome do proprietário usando o Instagram como referência.
              </p>
            </div>
            <Link
              href="/admin/pousadas/nova"
              className={cn(buttonVariants({ size: 'lg' }), 'shrink-0 gap-1.5')}
            >
              <Plus data-icon="inline-start" />
              Cadastrar pousada
            </Link>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-foreground font-display mb-4 text-lg font-medium">
              Destinos por volume
            </h3>
            {overview.featuredDestinations.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum destino cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {overview.featuredDestinations.map((d) => {
                  const max = overview.featuredDestinations[0]?.pousadas || 1
                  const pct = Math.min(100, Math.round((d.pousadas / max) * 100))
                  return (
                    <div key={d.slug}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">
                          {d.name} <span className="text-muted-foreground">· {d.state}</span>
                        </span>
                        <span className="text-muted-foreground">{d.pousadas}</span>
                      </div>
                      <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-ocean h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-foreground font-display mb-4 text-lg font-medium">
              Pousadas em destaque
            </h3>
            {overview.featuredPousadas.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma pousada publicada ainda.</p>
            ) : (
              <div className="space-y-3">
                {overview.featuredPousadas.map((p) => (
                  <div
                    key={p.slug}
                    className="bg-secondary/50 flex items-center gap-3 rounded-xl p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image || '/placeholder.svg'}
                      alt={p.name}
                      className="size-12 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground truncate font-medium">{p.name}</div>
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <MapPin className="size-3" /> {p.city}, {p.state}
                      </div>
                    </div>
                    <div className="text-foreground flex items-center gap-1 text-sm font-semibold">
                      <Star className="fill-gold text-gold size-4" />
                      {p.rating.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
