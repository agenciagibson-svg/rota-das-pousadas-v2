'use client'

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DollarSign,
  Download,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AreaChart, BarChart, Donut } from '@/components/dashboard/charts'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import type { PlatformKpis, GmvMonthPoint, RegionBookingCount, PousadaPerformance } from '../types'

const MONTH_OPTIONS = [3, 6, 12, 24]

/** `bookings.fee`/`total` são guardados em reais inteiros — mesmo formatador de admin-view.tsx. */
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}mil`
  return `R$ ${value.toFixed(0)}`
}

function formatDelta(pct: number | null): { label: string; positive: boolean } {
  if (pct === null) return { label: '—', positive: true }
  return { label: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct >= 0 }
}

/** Gera e baixa um CSV no navegador — sem chamada ao servidor, os dados já estão na tela. */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n')
  // BOM (﻿) pro Excel em pt-BR reconhecer UTF-8 e não corromper acentos.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Tela "Relatórios" — achado da avaliação de 19/09/2026: os cálculos ao vivo
 * (receita, ocupação, reservas por região) já existiam pra Visão Geral, mas
 * sem filtro de período nem forma de levar o número pra fora da plataforma.
 * Reaproveita os mesmos componentes de gráfico (`components/dashboard/charts`)
 * e adiciona seletor de janela + exportação CSV — sem dado novo, só o acesso
 * que faltava a um dado que já era real.
 */
export function ReportsView({
  months,
  kpis,
  gmvByMonth,
  bookingsByRegion,
  occupancyRate,
  pousadaPerformance,
}: {
  months: number
  kpis: PlatformKpis
  gmvByMonth: GmvMonthPoint[]
  bookingsByRegion: RegionBookingCount[]
  occupancyRate: number
  pousadaPerformance: PousadaPerformance[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const gmvDelta = formatDelta(kpis.gmvDeltaPct)

  const noResultCount = pousadaPerformance.filter((p) => p.noResult).length
  const sortedPerformance = [...pousadaPerformance].sort((a, b) => {
    if (a.noResult !== b.noResult) return a.noResult ? -1 : 1
    return a.gmv - b.gmv
  })

  function changeMonths(value: number) {
    startTransition(() => {
      router.push(`${pathname}?months=${value}`)
    })
  }

  const kpiCards = [
    {
      label: 'Volume processado (GMV) — mês',
      value: formatCurrency(kpis.gmvThisMonth),
      delta: gmvDelta,
      icon: DollarSign,
    },
    { label: 'Pousadas ativas', value: String(kpis.activePousadas), delta: null, icon: Building2 },
    {
      label: 'Reservas no mês',
      value: String(kpis.bookingsThisMonth),
      delta: null,
      icon: CheckCircle2,
    },
    {
      label: 'Novos anfitriões (mês)',
      value: String(kpis.newHostsThisMonth),
      delta: null,
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Período:</span>
        {MONTH_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={isPending}
            onClick={() => changeMonths(m)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              m === months
                ? 'border-ocean bg-ocean/10 text-ocean'
                : 'border-border text-foreground hover:bg-secondary'
            }`}
          >
            {m} meses
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-5">
            <div className="flex items-center justify-between">
              <IconBadge tone="ocean" size="md">
                <k.icon className="size-5" />
              </IconBadge>
              {k.delta && (
                <Badge variant="primarySoft" size="md" className="gap-1 px-2 py-0.5 font-semibold">
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-foreground font-serif text-lg font-semibold">GMV mensal</h3>
              <p className="text-muted-foreground text-sm">Últimos {months} meses</p>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `gmv-mensal-${months}m.csv`,
                  ['Mês', 'GMV (R$)'],
                  gmvByMonth.map((m) => [m.month, m.amount]),
                )
              }
              className="border-border text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              <Download className="size-3.5" />
              Exportar CSV
            </button>
          </div>
          <div className="h-40">
            <AreaChart data={gmvByMonth.map((m) => m.amount)} color="var(--ocean)" />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-foreground font-serif text-lg font-semibold">Taxa de ocupação</h3>
          <p className="text-muted-foreground text-sm">Aproximação da rede (mês atual)</p>
          <div className="mt-2 flex justify-center">
            <Donut value={occupancyRate} color="var(--ocean)" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-foreground font-serif text-lg font-semibold">
              Reservas por região
            </h3>
            <p className="text-muted-foreground text-sm">Top 5 estados (todas as reservas)</p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                'reservas-por-regiao.csv',
                ['Estado', 'Reservas'],
                bookingsByRegion.map((r) => [r.state, r.count]),
              )
            }
            className="border-border text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </button>
        </div>
        <div className="h-36">
          <BarChart
            data={bookingsByRegion.map((r) => r.count)}
            labels={bookingsByRegion.map((r) => r.state)}
            color="var(--ocean)"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-foreground font-serif text-lg font-semibold">
              Desempenho por pousada
            </h3>
            <p className="text-muted-foreground text-sm">
              Últimos 90 dias · {noResultCount} sem resultado
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                'desempenho-por-pousada-90d.csv',
                [
                  'Pousada',
                  'Cidade',
                  'UF',
                  'GMV (R$)',
                  'Reservas',
                  'Ocupação (%)',
                  'Sem resultado',
                ],
                sortedPerformance.map((p) => [
                  p.name,
                  p.city,
                  p.state,
                  p.gmv,
                  p.bookingsCount,
                  p.occupancyRate,
                  p.noResult ? 'sim' : 'não',
                ]),
              )
            }
            className="border-border text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Download className="size-3.5" />
            Exportar CSV
          </button>
        </div>
        {sortedPerformance.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma pousada publicada ainda.</p>
        ) : (
          <div className="space-y-2">
            {sortedPerformance.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 rounded-xl p-3 ${
                  p.noResult ? 'bg-destructive/10' : 'bg-secondary/50'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate font-medium">{p.name}</span>
                    {p.noResult && (
                      <Badge
                        variant="destructiveSoft"
                        size="md"
                        className="gap-1 px-2 py-0.5 font-semibold"
                      >
                        <AlertTriangle className="size-3" />
                        Sem resultado
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {p.city}/{p.state} · {formatCurrency(p.gmv)} · {p.bookingsCount} reserva(s) ·{' '}
                    {p.occupancyRate.toFixed(1)}% ocupação
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
