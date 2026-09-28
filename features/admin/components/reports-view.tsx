'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  CalendarClock,
  CalendarDays,
  DollarSign,
  Download,
  Minus,
  Percent,
  Receipt,
  Search,
  Star,
  XCircle,
} from 'lucide-react'
import { AreaChart } from '@/components/dashboard/charts'
import { Card } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { formatBRL, formatISODate } from '@/lib/format'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import {
  MACRO_REGIONS,
  PERIOD_LABEL,
  REPORT_PERIODS,
  type GroupRow,
  type MacroRegion,
  type Metric,
  type PousadaRow,
  type PousadaStatus,
  type ReportData,
  type ReportPeriod,
} from '../report-metrics'

/** Cores por macrorregião — ordem fixa (a cor segue a região, nunca a posição no ranking). Paleta validada para daltonismo. */
const REGION_COLOR: Record<MacroRegion, string> = {
  Sudeste: '#2a78d6',
  Sul: '#eb6834',
  Nordeste: '#1baf7a',
  'Centro-Oeste': '#eda100',
  Norte: '#e87ba4',
}

const STATUS_LABEL: Record<string, string> = {
  quote: 'Cotação',
  pending: 'Aguardando pagamento',
  confirmed: 'Confirmada',
  checked_in: 'Em estadia',
  checked_out: 'Concluída',
  cancelled: 'Cancelada',
  no_show: 'Não compareceu',
}

const POUSADA_STATUS: Record<PousadaStatus, { label: string; cls: string }> = {
  crescendo: { label: 'Crescendo', cls: 'bg-emerald-50 text-emerald-800' },
  estavel: { label: 'Estável', cls: 'bg-secondary text-foreground' },
  caindo: { label: 'Caindo', cls: 'bg-amber-50 text-amber-900' },
  sem_resultado: { label: 'Sem reservas', cls: 'bg-red-50 text-red-800' },
  nova: { label: 'Nova', cls: 'bg-sky-50 text-sky-800' },
  sem_quartos: { label: 'Sem acomodação', cls: 'bg-red-50 text-red-800' },
}

const money = (v: number) => formatBRL(v).replace(/,00$/, '')
const num = (v: number) => v.toLocaleString('pt-BR')

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
    >
      <Download className="size-3.5" />
      CSV
    </button>
  )
}

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null)
    return (
      <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
        novo
      </span>
    )
  if (value === 0)
    return (
      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px] font-semibold">
        <Minus className="size-3" /> 0%
      </span>
    )
  const good = invert ? value < 0 : value > 0
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        good ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
      }`}
    >
      <Icon className="size-3" />
      {value > 0 ? '+' : ''}
      {value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  )
}

function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-foreground font-serif text-lg font-semibold">{title}</h3>
        {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

/** Barras horizontais com rótulo e valor visíveis (a tabela ao lado é a leitura exata). */
function HBars({
  rows,
  color = 'var(--ocean)',
  format = money,
}: {
  rows: { key: string; label: string; value: number; hint?: string; color?: string }[]
  color?: string
  format?: (v: number) => string
}) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1
  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">Sem dados no período.</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li
          key={r.key}
          className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
          title={`${r.label}: ${format(r.value)}${r.hint ? ` · ${r.hint}` : ''}`}
        >
          <span className="text-foreground truncate font-medium">{r.label}</span>
          <span className="bg-secondary/70 relative h-3 overflow-hidden rounded">
            <span
              className="absolute inset-y-0 left-0 rounded-r"
              style={{
                width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`,
                background: r.color ?? color,
              }}
            />
          </span>
          <span className="text-foreground text-right text-xs font-semibold tabular-nums">
            {format(r.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Th({
  children,
  right,
  onClick,
  active,
}: {
  children: React.ReactNode
  right?: boolean
  onClick?: () => void
  active?: boolean
}) {
  return (
    <th
      className={`text-muted-foreground px-3 py-2 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase ${right ? 'text-right' : 'text-left'}`}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={`uppercase ${active ? 'text-foreground underline underline-offset-4' : ''}`}
        >
          {children}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

// ---------------------------------------------------------------------------

export function ReportsView({ data }: { data: ReportData }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const { kpis, period } = data
  const suffix = `${period}-${data.window.end}`

  function changePeriod(p: ReportPeriod) {
    startTransition(() => router.push(`${pathname}?period=${p}`))
  }

  const kpiCards: {
    label: string
    value: string
    metric: Metric
    icon: typeof DollarSign
    invert?: boolean
    neutral?: boolean
    hint?: string
  }[] = [
    {
      label: 'Volume em reservas',
      value: money(kpis.volume.value),
      metric: kpis.volume,
      icon: DollarSign,
      hint: 'Valor das reservas confirmadas (vai para as pousadas).',
    },
    {
      label: 'Reservas confirmadas',
      value: num(kpis.bookings.value),
      metric: kpis.bookings,
      icon: CalendarDays,
    },
    {
      label: 'Ticket médio',
      value: money(kpis.avgTicket.value),
      metric: kpis.avgTicket,
      icon: Receipt,
    },
    {
      label: 'Ocupação da rede',
      value: `${kpis.occupancy.value.toLocaleString('pt-BR')}%`,
      metric: kpis.occupancy,
      icon: Percent,
      hint: 'Noites hospedadas ÷ (quartos ativos × dias).',
    },
    {
      label: 'Diárias vendidas',
      value: num(kpis.nightsSold.value),
      metric: kpis.nightsSold,
      icon: BedDouble,
    },
    {
      label: 'Estadia média',
      value: `${kpis.avgStay.value.toLocaleString('pt-BR')} noites`,
      metric: kpis.avgStay,
      icon: BedDouble,
    },
    {
      label: 'Antecedência média',
      value: `${kpis.leadTimeDays.value.toLocaleString('pt-BR')} dias`,
      metric: kpis.leadTimeDays,
      icon: CalendarClock,
      neutral: true,
      hint: 'Dias entre a reserva e o check-in.',
    },
    {
      label: 'Cancelamento e no-show',
      value: `${kpis.cancelRate.value.toLocaleString('pt-BR')}%`,
      metric: kpis.cancelRate,
      icon: XCircle,
      invert: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Período:</span>
        {REPORT_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={isPending}
            onClick={() => changePeriod(p)}
            aria-pressed={p === period}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
              p === period
                ? 'border-ocean bg-ocean/10 text-ocean'
                : 'border-border text-foreground hover:bg-secondary'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
        <span className="text-muted-foreground ml-auto text-xs">
          {formatISODate(data.window.start)} a {formatISODate(data.window.end)} · comparado com os{' '}
          {data.window.days} dias anteriores
        </span>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-4" title={k.hint}>
            <div className="flex items-center justify-between gap-2">
              <IconBadge tone="ocean" size="sm">
                <k.icon className="size-4" />
              </IconBadge>
              {k.neutral ? (
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  antes: {k.metric.previous.toLocaleString('pt-BR')}
                </span>
              ) : (
                <Delta value={k.metric.deltaPct} invert={k.invert} />
              )}
            </div>
            <div className="text-foreground mt-3 text-xl font-semibold tabular-nums">{k.value}</div>
            <div className="text-muted-foreground text-xs">{k.label}</div>
          </Card>
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span>
          <strong className="text-foreground">{kpis.activePousadas}</strong> pousadas publicadas ·{' '}
          <strong className="text-foreground">{kpis.pousadasWithSales}</strong> venderam no período
        </span>
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          {kpis.rating.value !== null ? (
            <>
              nota média{' '}
              <strong className="text-foreground">
                {kpis.rating.value.toLocaleString('pt-BR')}
              </strong>{' '}
              em {kpis.rating.count} avaliações do período
            </>
          ) : (
            'nenhuma avaliação no período'
          )}
        </span>
      </div>

      {/* Evolução + dia da semana */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <SectionTitle
            title="Evolução das vendas"
            hint={`Volume em reservas por ${data.window.days <= 92 ? 'semana' : 'mês'} (data da reserva)`}
            action={
              <CsvButton
                onClick={() =>
                  downloadCsv(
                    `vendas-${suffix}.csv`,
                    ['Período', 'Volume (R$)', 'Reservas'],
                    data.series.map((s) => [s.label, s.volume, s.bookings]),
                  )
                }
              />
            }
          />
          <div className="h-44">
            <AreaChart
              data={data.series.map((s) => s.volume)}
              labels={data.series.map((s) => s.label)}
              color="var(--ocean)"
              format={money}
            />
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle title="Check-ins por dia da semana" hint="Reservas vendidas no período" />
          <HBars
            rows={data.weekdays.map((w) => ({ key: w.label, label: w.label, value: w.count }))}
            format={(v) => num(v)}
          />
        </Card>
      </div>

      <RegionSection data={data} suffix={suffix} />
      <PousadaSection data={data} suffix={suffix} />

      {/* Canais + status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle
            title="Canais de venda"
            hint="De onde vieram as reservas confirmadas"
            action={
              <CsvButton
                onClick={() =>
                  downloadCsv(
                    `canais-${suffix}.csv`,
                    ['Canal', 'Reservas', '% das reservas', 'Volume (R$)'],
                    data.origins.map((o) => [
                      ORIGIN_LABEL[o.key as keyof typeof ORIGIN_LABEL] ?? o.key,
                      o.count,
                      o.share,
                      o.volume,
                    ]),
                  )
                }
              />
            }
          />
          <HBars
            rows={data.origins.map((o) => ({
              key: o.key,
              label: ORIGIN_LABEL[o.key as keyof typeof ORIGIN_LABEL] ?? o.key,
              value: o.share,
              hint: `${o.count} reservas · ${money(o.volume)}`,
            }))}
            format={(v) => `${v.toLocaleString('pt-BR')}%`}
          />
        </Card>
        <Card className="p-6">
          <SectionTitle title="Situação das reservas" hint="Todas as reservas criadas no período" />
          <HBars
            rows={data.statuses.map((s) => ({
              key: s.key,
              label: STATUS_LABEL[s.key] ?? s.key,
              value: s.count,
              hint: `${s.share}%`,
              color: s.key === 'cancelled' || s.key === 'no_show' ? '#c2410c' : undefined,
            }))}
            format={(v) => num(v)}
          />
        </Card>
      </div>

      {/* Alertas */}
      <Card className="p-6">
        <SectionTitle title="Pontos de atenção" hint="Pousadas que pedem contato da equipe" />
        {data.alerts.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nada fora do normal no período.</p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {data.alerts.map((a, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${a.kind === 'sem_quartos' || a.kind === 'sem_resultado' ? 'text-red-600' : 'text-amber-600'}`}
                />
                <span>
                  <strong className="text-foreground">{a.pousada}</strong>
                  <span className="text-muted-foreground"> — {a.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-muted-foreground text-xs">
        Volume, reservas, ticket, canais e cancelamento contam as reservas criadas no período.
        Ocupação conta as noites hospedadas dentro do período. O volume é dinheiro das pousadas, não
        receita da Rota — a receita da Rota está em Financeiro.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Região
// ---------------------------------------------------------------------------
function RegionSection({ data, suffix }: { data: ReportData; suffix: string }) {
  const [level, setLevel] = useState<'uf' | 'cidade'>('uf')
  const [region, setRegion] = useState<MacroRegion | 'todas'>('todas')
  const totalVolume = data.regions.reduce((s, r) => s + r.volume, 0)
  const rows: GroupRow[] = (level === 'uf' ? data.states : data.cities).filter(
    (r) => region === 'todas' || r.region === region,
  )

  return (
    <Card className="p-6">
      <SectionTitle
        title="Desempenho por região"
        hint="Volume, reservas e ocupação por macrorregião, estado e cidade"
        action={
          <CsvButton
            onClick={() =>
              downloadCsv(
                `regioes-${level}-${suffix}.csv`,
                [
                  level === 'uf' ? 'UF' : 'Cidade',
                  'Região',
                  'Pousadas',
                  'Volume (R$)',
                  'Variação (%)',
                  'Reservas',
                  'Ocupação (%)',
                  'Ticket médio (R$)',
                ],
                rows.map((r) => [
                  r.label,
                  r.region ?? '',
                  r.pousadas,
                  r.volume,
                  r.deltaPct ?? '',
                  r.bookings,
                  r.occupancy,
                  r.avgTicket,
                ]),
              )
            }
          />
        }
      />

      {/* Participação por macrorregião */}
      <div>
        <div
          className="bg-secondary flex h-4 w-full overflow-hidden rounded-md"
          role="img"
          aria-label="Participação no volume por macrorregião"
        >
          {totalVolume > 0 &&
            data.regions
              .filter((r) => r.volume > 0)
              .map((r) => (
                <span
                  key={r.key}
                  title={`${r.label}: ${money(r.volume)} (${((r.volume / totalVolume) * 100).toFixed(1)}%)`}
                  className="h-full border-r-2 border-white last:border-r-0"
                  style={{
                    width: `${(r.volume / totalVolume) * 100}%`,
                    background: REGION_COLOR[r.key as MacroRegion],
                  }}
                />
              ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MACRO_REGIONS.map((name) => {
            const r = data.regions.find((x) => x.key === name)!
            const active = region === name
            return (
              <button
                key={name}
                type="button"
                onClick={() => setRegion(active ? 'todas' : name)}
                aria-pressed={active}
                className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-foreground bg-secondary/60' : 'border-border hover:bg-secondary/40'}`}
              >
                <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: REGION_COLOR[name] }}
                  />
                  {name}
                </span>
                <span className="text-foreground mt-1 block text-base font-semibold tabular-nums">
                  {money(r.volume)}
                </span>
                <span className="text-muted-foreground block text-xs tabular-nums">
                  {totalVolume > 0 ? `${((r.volume / totalVolume) * 100).toFixed(0)}% · ` : ''}
                  {r.bookings} reservas · {r.pousadas} pousadas
                </span>
                <span className="mt-1 block">
                  <Delta value={r.deltaPct} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(['uf', 'cidade'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLevel(l)}
            aria-pressed={level === l}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${level === l ? 'border-ocean bg-ocean/10 text-ocean' : 'border-border text-foreground hover:bg-secondary'}`}
          >
            Por {l === 'uf' ? 'estado' : 'cidade'}
          </button>
        ))}
        {region !== 'todas' && (
          <button
            type="button"
            onClick={() => setRegion('todas')}
            className="text-muted-foreground text-xs underline"
          >
            Filtrando {region} · limpar
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <HBars
            rows={rows.slice(0, 10).map((r) => ({
              key: r.key,
              label: r.label,
              value: r.volume,
              color: r.region ? REGION_COLOR[r.region] : undefined,
              hint: `${r.bookings} reservas`,
            }))}
          />
        </div>
        <div className="overflow-x-auto lg:col-span-3">
          <table className="w-full text-sm">
            <thead className="border-border border-b">
              <tr>
                <Th>{level === 'uf' ? 'UF' : 'Cidade'}</Th>
                <Th right>Pousadas</Th>
                <Th right>Volume</Th>
                <Th right>Variação</Th>
                <Th right>Reservas</Th>
                <Th right>Ocupação</Th>
                <Th right>Ticket</Th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted-foreground px-3 py-4 text-center">
                    Nenhuma pousada publicada nesta região.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key}>
                    <td className="text-foreground px-3 py-2 font-medium whitespace-nowrap">
                      <span
                        className="mr-2 inline-block size-2 rounded-sm"
                        style={{ background: r.region ? REGION_COLOR[r.region] : '#a3a3a3' }}
                      />
                      {r.label}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.pousadas}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {money(r.volume)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Delta value={r.deltaPct} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.bookings}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.occupancy.toLocaleString('pt-BR')}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.avgTicket ? money(r.avgTicket) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Pousadas
// ---------------------------------------------------------------------------
type SortKey =
  'volume' | 'deltaPct' | 'bookings' | 'occupancy' | 'avgTicket' | 'cancelRate' | 'rating'

function PousadaSection({ data, suffix }: { data: ReportData; suffix: string }) {
  const [sort, setSort] = useState<SortKey>('volume')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PousadaStatus | 'todas'>('todas')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return data.pousadas
      .filter((p) => (status === 'todas' ? true : p.status === status))
      .filter((p) => !term || `${p.name} ${p.city} ${p.state}`.toLowerCase().includes(term))
      .sort(
        (a, b) =>
          ((b[sort] ?? -Infinity) as number) - ((a[sort] ?? -Infinity) as number) ||
          a.name.localeCompare(b.name),
      )
  }, [data.pousadas, q, sort, status])

  const counts = useMemo(() => {
    const c: Partial<Record<PousadaStatus, number>> = {}
    for (const p of data.pousadas) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [data.pousadas])

  const top = data.pousadas.filter((p) => p.volume > 0).slice(0, 10)

  const th = (key: SortKey, label: string) => (
    <Th right onClick={() => setSort(key)} active={sort === key}>
      {label}
    </Th>
  )

  return (
    <Card className="p-6">
      <SectionTitle
        title="Desempenho por pousada"
        hint="Ranking das pousadas publicadas no período, com tendência em relação ao período anterior"
        action={
          <CsvButton
            onClick={() =>
              downloadCsv(
                `pousadas-${suffix}.csv`,
                [
                  'Pousada',
                  'Cidade',
                  'UF',
                  'Região',
                  'Quartos',
                  'Volume (R$)',
                  'Volume anterior (R$)',
                  'Variação (%)',
                  'Reservas',
                  'Noites',
                  'Ocupação (%)',
                  'Ticket médio (R$)',
                  'Cancelamento (%)',
                  'Nota',
                  'Avaliações',
                  'Situação',
                ],
                rows.map((p: PousadaRow) => [
                  p.name,
                  p.city,
                  p.state,
                  p.region ?? '',
                  p.rooms,
                  p.volume,
                  p.volumePrev,
                  p.deltaPct ?? '',
                  p.bookings,
                  p.nights,
                  p.occupancy,
                  p.avgTicket,
                  p.cancelRate,
                  p.rating ?? '',
                  p.reviews,
                  POUSADA_STATUS[p.status].label,
                ]),
              )
            }
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            Top 10 em volume
          </p>
          <HBars
            rows={top.map((p) => ({
              key: p.id,
              label: p.name,
              value: p.volume,
              color: p.region ? REGION_COLOR[p.region] : undefined,
              hint: `${p.city}/${p.state} · ${p.bookings} reservas`,
            }))}
          />
        </div>
        <div className="lg:col-span-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                'crescendo',
                'estavel',
                'caindo',
                'sem_resultado',
                'nova',
                'sem_quartos',
              ] as PousadaStatus[]
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(status === s ? 'todas' : s)}
                aria-pressed={status === s}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${status === s ? 'border-foreground' : 'border-border hover:bg-secondary/40'}`}
              >
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${POUSADA_STATUS[s].cls}`}
                >
                  {POUSADA_STATUS[s].label}
                </span>
                <span className="text-foreground font-semibold tabular-nums">{counts[s] ?? 0}</span>
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            Crescendo: volume subiu 20% ou mais. Caindo: caiu 20% ou mais. Nova: publicada há menos
            de 30 dias.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="border-border flex items-center gap-2 rounded-lg border px-3 py-1.5">
          <Search className="text-muted-foreground size-3.5" />
          <input
            id="report-pousada-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pousada ou cidade"
            aria-label="Buscar pousada ou cidade"
            className="w-48 bg-transparent text-sm outline-none"
          />
        </label>
        {status !== 'todas' && (
          <button
            type="button"
            onClick={() => setStatus('todas')}
            className="text-muted-foreground text-xs underline"
          >
            Mostrando “{POUSADA_STATUS[status].label}” · limpar
          </button>
        )}
        <span className="text-muted-foreground ml-auto text-xs">
          {rows.length} de {data.pousadas.length} pousadas · clique no título da coluna para ordenar
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-border border-b">
            <tr>
              <Th>Pousada</Th>
              {th('volume', 'Volume')}
              {th('deltaPct', 'Variação')}
              {th('bookings', 'Reservas')}
              {th('occupancy', 'Ocupação')}
              {th('avgTicket', 'Ticket')}
              {th('cancelRate', 'Cancel.')}
              {th('rating', 'Nota')}
              <Th>Situação</Th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-muted-foreground px-3 py-4 text-center">
                  Nenhuma pousada encontrada.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/pousada/${p.slug}`}
                      target="_blank"
                      className="text-foreground font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {p.city}/{p.state} · {p.rooms} {p.rooms === 1 ? 'quarto' : 'quartos'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {money(p.volume)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Delta value={p.deltaPct} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.bookings}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.occupancy.toLocaleString('pt-BR')}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.avgTicket ? money(p.avgTicket) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.cancelRate ? `${p.cancelRate.toLocaleString('pt-BR')}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {p.rating !== null ? `${p.rating.toLocaleString('pt-BR')} (${p.reviews})` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${POUSADA_STATUS[p.status].cls}`}
                    >
                      {POUSADA_STATUS[p.status].label}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
