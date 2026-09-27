'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarX2, Check, Copy, ExternalLink, MessageCircleMore, TrendingUp } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { BarChart } from '@/components/dashboard/charts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { buildHighlights, calculateRates } from '../report'
import {
  QUOTE_STATUS_LABEL,
  type LinkReport,
  type QuoteRequest,
  type QuoteRequestStatus,
} from '../types'
import { updateQuoteStatusAction } from '../actions'
import { formatBRL } from '@/lib/format'

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
] as const

/** Últimos 14 dias no gráfico: 30 barras num celular viram borrão. */
const CHART_DAYS = 14

function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function periodoLabel(q: QuoteRequest): string {
  if (!q.checkin) return 'Sem data definida'
  if (!q.checkout) return `A partir de ${fmtDay(q.checkin)}`
  return `${fmtDay(q.checkin)} a ${fmtDay(q.checkout)}`
}

function statusVariant(status: QuoteRequestStatus) {
  if (status === 'novo') return 'goldSoft' as const
  if (status === 'convertido') return 'primarySoft' as const
  if (status === 'descartado') return 'destructiveSoft' as const
  return 'secondary' as const
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="border-border bg-secondary/40 flex flex-wrap items-center gap-2 rounded-xl border p-3">
      <span className="text-foreground min-w-0 flex-1 font-mono text-xs break-all">{url}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        }}
        className="border-input hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
      >
        {copied ? <Check className="text-primary size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="border-input hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
      >
        <ExternalLink className="size-3.5" /> Abrir
      </a>
    </div>
  )
}

function QuoteCardRow({ quote, canManage }: { quote: QuoteRequest; canManage: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mark(status: QuoteRequestStatus) {
    setPending(true)
    setError(null)
    try {
      const result = await updateQuoteStatusAction({
        requestId: quote.id,
        status,
        notes: quote.internalNotes,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    } catch {
      setError('Não foi possível atualizar o pedido. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  const whats = quote.phone.replace(/\D/g, '')

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground font-semibold">{quote.name}</h3>
            <Badge variant={statusVariant(quote.status)}>{QUOTE_STATUS_LABEL[quote.status]}</Badge>
            {quote.occasion && <Badge variant="secondary">{quote.occasion}</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {periodoLabel(quote)} · {quote.adults} {quote.adults === 1 ? 'adulto' : 'adultos'}
            {quote.children > 0 &&
              `, ${quote.children} ${quote.children === 1 ? 'criança' : 'crianças'}`}
            {quote.pets && ' · com pet'}
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {fmtDateTime(quote.createdAt)}
        </span>
      </div>

      {quote.message && (
        <p className="bg-secondary/50 text-foreground mt-3 rounded-lg p-3 text-sm">
          {quote.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={`https://wa.me/${whats}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-input hover:bg-secondary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <MessageCircleMore className="size-3.5" /> {quote.phone}
        </a>
        {quote.email && (
          <a
            href={`mailto:${quote.email}`}
            className="border-input hover:bg-secondary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {quote.email}
          </a>
        )}
      </div>

      {canManage && quote.status !== 'convertido' && (
        <div className="border-border mt-3 flex flex-wrap gap-2 border-t pt-3">
          {quote.status === 'novo' && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark('respondido')}>
              Marcar como respondido
            </Button>
          )}
          <Button size="sm" disabled={pending} onClick={() => mark('convertido')}>
            Virou reserva
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark('descartado')}>
            Descartar
          </Button>
          {error && (
            <p role="alert" className="text-destructive w-full text-sm font-medium">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

export function LinkReportView({
  displayName,
  pousadaName,
  bioUrl,
  report,
  quotes,
  canManage,
  days,
}: {
  displayName: string
  pousadaName: string
  bioUrl: string
  report: LinkReport
  quotes: QuoteRequest[]
  canManage: boolean
  days: number
}) {
  const highlights = buildHighlights(report)
  const rates = calculateRates(report.totals)
  const recent = report.daily.slice(-CHART_DAYS)
  const novos = quotes.filter((q) => q.status === 'novo')

  return (
    <DashboardShell
      nav={ownerDashboardNav('link')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Link da bio"
      subtitle="O que acontece no link que você publica no Instagram."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <CopyLink url={bioUrl} />

      {/* Destaques primeiro: é a leitura, não o número, que muda a semana. */}
      <div className="mt-5 flex flex-col gap-2.5">
        {highlights.map((h) => (
          <div
            key={h.title}
            className={`rounded-xl border p-4 ${
              h.tone === 'atencao'
                ? 'border-gold/40 bg-gold/10'
                : h.tone === 'bom'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card'
            }`}
          >
            <p className="text-foreground font-semibold">{h.title}</p>
            <p className="text-muted-foreground mt-1 text-sm">{h.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground font-semibold">Números do período</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p.days}
              href={`/dashboard/link?dias=${p.days}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === p.days
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Visitas"
          value={String(report.totals.views)}
          delta={`${rates.searchRate}% consultaram datas`}
          up
          icon={TrendingUp}
        />
        <StatCard
          label="Consultas"
          value={String(report.totals.searches)}
          delta={`${rates.unavailableRate}% sem vaga`}
          up={rates.unavailableRate < 30}
          icon={CalendarX2}
        />
        <StatCard
          label="Pedidos de orçamento"
          value={String(report.totals.quotes)}
          delta={novos.length > 0 ? `${novos.length} sem resposta` : 'tudo respondido'}
          up={novos.length === 0}
          icon={MessageCircleMore}
        />
        <StatCard
          label="Reservas pelo link"
          value={String(report.totals.bookings)}
          delta={formatBRL(report.totals.revenue)}
          up
          icon={Check}
        />
      </div>

      <Card className="mt-5 p-5">
        <h2 className="text-foreground font-semibold">Últimos {recent.length} dias</h2>
        <p className="text-muted-foreground text-sm">Consultas de disponibilidade por dia.</p>
        <div className="mt-5 h-40">
          {recent.some((d) => d.searches > 0 || d.views > 0) ? (
            <BarChart
              data={recent.map((d) => d.searches)}
              labels={recent.map((d) => fmtDay(d.day))}
              color="var(--ocean)"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
              Nenhum movimento ainda neste período.
            </div>
          )}
        </div>
      </Card>

      {report.unmetDemand.length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="text-foreground font-semibold">Procuraram e não tinha vaga</h2>
          <p className="text-muted-foreground text-sm">
            Cada linha é uma data que alguém tentou reservar e não encontrou acomodação.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {report.unmetDemand.map((item) => (
              <div
                key={`${item.checkin}-${item.checkout}-${item.guests}`}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5"
              >
                <span className="text-foreground text-sm font-medium">
                  {item.checkout
                    ? `${fmtDay(item.checkin)} a ${fmtDay(item.checkout)}`
                    : fmtDay(item.checkin)}
                  {item.guests > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      · {item.guests} {item.guests === 1 ? 'hóspede' : 'hóspedes'}
                    </span>
                  )}
                </span>
                <Badge variant="goldSoft">
                  {item.tries} {item.tries === 1 ? 'tentativa' : 'tentativas'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground font-semibold">Pedidos de orçamento</h2>
        {novos.length > 0 && <Badge variant="goldSoft">{novos.length} sem resposta</Badge>}
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={MessageCircleMore}
          title="Nenhum pedido ainda"
          description="Quando alguém pedir um orçamento pela página da bio, ele aparece aqui com as datas e o contato já preenchidos."
        />
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {quotes.map((quote) => (
            <QuoteCardRow key={quote.id} quote={quote} canManage={canManage} />
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
