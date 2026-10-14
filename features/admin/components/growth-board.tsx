'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Copy,
  Handshake,
  Megaphone,
  MessageCircle,
  Rocket,
  Search,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatBRL, formatDateTime, formatISODate, whatsappLink } from '@/lib/format'
import { addActivityAction, saveOpportunityAction } from '../growth-actions'
import {
  GROWTH_STAGES,
  RECOMMENDATION_LABEL,
  STAGE_LABEL,
  type GrowthStage,
  type Recommendation,
} from '../growth'
import { PERIOD_LABEL, type ReportPeriod } from '../report-metrics'
import type { GrowthBoard, GrowthItem } from '../services/growth.service'

const money = (v: number) => formatBRL(v).replace(/,00$/, '')

const STAGE_CLS: Record<GrowthStage, string> = {
  a_oferecer: 'bg-secondary text-foreground',
  oferecido: 'bg-secondary text-foreground',
  interessado: 'bg-ipe/20 text-foreground',
  aceito: 'bg-breu text-neblina',
  campanha_ativa: 'bg-success/10 text-success',
  encerrado: 'bg-secondary text-muted-foreground',
  recusado: 'bg-destructive/10 text-destructive',
}

const REC_STYLE: Record<Recommendation, { cls: string; icon: typeof Rocket }> = {
  trafego: { cls: 'bg-ocean/10 text-ocean', icon: Megaphone },
  arrumar_perfil: { cls: 'bg-ipe/20 text-foreground', icon: Wrench },
  acompanhar: { cls: 'bg-secondary text-foreground', icon: CheckCircle2 },
}

const inputCls =
  'border-input bg-card text-foreground focus:border-ring w-full rounded-lg border px-3 py-2 text-sm outline-none'

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  )
}

function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-foreground text-xs font-semibold">novo</span>
  if (v === 0) return <span className="text-muted-foreground text-xs">0%</span>
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${v > 0 ? 'text-success' : 'text-destructive'}`}
    >
      {v > 0 ? '+' : ''}
      {v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
    </span>
  )
}

export function GrowthBoardView({
  board,
  periods,
}: {
  board: GrowthBoard
  periods: ReportPeriod[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const [stage, setStage] = useState<GrowthStage | 'todas'>('todas')
  const [rec, setRec] = useState<Recommendation | 'todas'>('todas')
  const [q, setQ] = useState('')
  const { summary } = board

  const items = useMemo(() => {
    const term = q.trim().toLowerCase()
    return board.items.filter(
      (i) =>
        (stage === 'todas' || (i.opportunity?.stage ?? 'a_oferecer') === stage) &&
        (rec === 'todas' || i.diagnosis.recommendation === rec) &&
        (!term || `${i.row.name} ${i.row.city} ${i.row.state}`.toLowerCase().includes(term)),
    )
  }, [board.items, stage, rec, q])

  const campaigns = board.items.filter((i) => i.campaign && i.campaign.checkpoints.length > 0)

  const tiles = [
    {
      label: 'Pediram ajuda pelo painel',
      value: summary.askedHelp,
      icon: BellRing,
      tone: summary.askedHelp ? 'text-foreground' : '',
    },
    { label: 'Prontas para tráfego pago', value: summary.toOffer, icon: Megaphone },
    { label: 'Precisam arrumar o perfil', value: summary.fixProfile, icon: Wrench },
    { label: 'Em negociação', value: summary.negotiating, icon: Handshake },
    { label: 'Campanhas ativas', value: summary.activeCampaigns, icon: Rocket },
    { label: 'Receita mensal do serviço', value: money(summary.serviceMrr), icon: Wallet },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Desempenho dos últimos:</span>
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            disabled={pending}
            aria-pressed={p === board.period}
            onClick={() => start(() => router.push(`${pathname}?period=${p}`))}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              p === board.period
                ? 'border-ocean bg-ocean/10 text-ocean'
                : 'border-border text-foreground hover:bg-secondary'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
        {summary.contactsDue > 0 && (
          <span className="bg-ipe/15 text-foreground ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
            <CalendarClock className="size-3.5" /> {summary.contactsDue} contato(s) para hoje ou
            atrasados
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <t.icon className={`size-4 ${t.tone || 'text-ocean'}`} />
            <div className="text-foreground mt-2 text-xl font-semibold tabular-nums">{t.value}</div>
            <div className="text-muted-foreground text-xs">{t.label}</div>
          </Card>
        ))}
      </div>

      {/* Funil */}
      <Card className="p-5">
        <p className="text-foreground mb-3 text-sm font-semibold">Funil da oferta</p>
        <div className="flex flex-wrap gap-2">
          {GROWTH_STAGES.map((s, idx) => (
            <button
              key={s}
              type="button"
              aria-pressed={stage === s}
              onClick={() => setStage(stage === s ? 'todas' : s)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                stage === s ? 'border-foreground' : 'border-border hover:bg-secondary/50'
              }`}
            >
              {idx > 0 && idx < 5 && <span className="text-muted-foreground -ml-1 text-xs">→</span>}
              <Pill className={STAGE_CLS[s]}>{STAGE_LABEL[s]}</Pill>
              <span className="text-foreground font-semibold tabular-nums">
                {summary.byStage[s]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {campaigns.length > 0 && (
        <Card className="p-6">
          <h3 className="text-foreground font-display text-lg font-medium">
            Resultado das campanhas
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Reservas feitas depois do início da campanha comparadas com o mesmo número de dias
            antes. Use como case para oferecer a outras pousadas.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((i) => (
              <CampaignCard key={i.row.id} item={i} />
            ))}
          </div>
        </Card>
      )}

      {/* Lista */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="border-border flex items-center gap-2 rounded-lg border px-3 py-1.5">
          <Search className="text-muted-foreground size-3.5" />
          <input
            id="growth-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pousada ou cidade"
            aria-label="Buscar pousada ou cidade"
            className="w-48 bg-transparent text-sm outline-none"
          />
        </label>
        {(['trafego', 'arrumar_perfil', 'acompanhar'] as Recommendation[]).map((r) => {
          const Icon = REC_STYLE[r].icon
          return (
            <button
              key={r}
              type="button"
              aria-pressed={rec === r}
              onClick={() => setRec(rec === r ? 'todas' : r)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                rec === r ? 'border-foreground' : 'border-border hover:bg-secondary/50'
              }`}
            >
              <Icon className="size-3.5" /> {RECOMMENDATION_LABEL[r]}
            </button>
          )
        })}
        <span className="text-muted-foreground ml-auto text-xs">
          {items.length} de {board.items.length} pousadas · ordem: pediram ajuda, contatos vencidos,
          prioridade
        </span>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma pousada com esse filtro.</p>
        ) : (
          items.map((i) => <GrowthRow key={i.row.id} item={i} today={board.today} />)
        )}
      </div>
    </div>
  )
}

function CampaignCard({ item }: { item: GrowthItem }) {
  const c = item.campaign!
  const last = c.checkpoints[c.checkpoints.length - 1]!
  return (
    <div className="border-border rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-foreground font-semibold">{item.row.name}</span>
        <span className="text-muted-foreground text-xs">
          desde {formatISODate(item.opportunity!.campaignStart!)} · {c.elapsedDays} dias
        </span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs font-medium">
              <th className="py-1 font-semibold">Janela</th>
              <th className="py-1 text-right font-semibold">Reservas antes → depois</th>
              <th className="py-1 text-right font-semibold">Volume antes → depois</th>
              <th className="py-1 text-right font-semibold">Ocupação</th>
            </tr>
          </thead>
          <tbody>
            {c.checkpoints.map((k) => (
              <tr key={k.days} className="border-border border-t">
                <td className="py-1.5">{k.days} dias</td>
                <td className="py-1.5 text-right tabular-nums">
                  {k.before.bookings} → <strong>{k.after.bookings}</strong>
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {money(k.before.volume)} → <strong>{money(k.after.volume)}</strong>{' '}
                  <Delta v={k.volumeDeltaPct} />
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {k.before.occupancy.toLocaleString('pt-BR')}% →{' '}
                  {k.after.occupancy.toLocaleString('pt-BR')}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Investimento em {last.days} dias (serviço + verba):{' '}
        <strong className="text-foreground">{money(last.investment)}</strong>
        {last.returnMultiple !== null && (
          <>
            {' '}
            · cada R$ 1 investido trouxe{' '}
            <strong className={last.returnMultiple >= 1 ? 'text-success' : 'text-destructive'}>
              R$ {last.returnMultiple.toLocaleString('pt-BR')}
            </strong>{' '}
            a mais em reservas
          </>
        )}
        {last.investment === 0 && ' · informe mensalidade e verba para calcular o retorno'}
      </p>
    </div>
  )
}

function GrowthRow({ item, today }: { item: GrowthItem; today: string }) {
  const { row, diagnosis: d, opportunity: o, profile } = item
  const stage = o?.stage ?? 'a_oferecer'
  const asked = !!o?.ownerInterestAt && stage === 'interessado'
  const due = !!o?.nextContact && o.nextContact <= today
  const RecIcon = REC_STYLE[d.recommendation].icon
  const wa = whatsappLink(profile?.whatsapp || profile?.phone)

  return (
    <details className="group bg-card border-border rounded-2xl border open:shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground font-semibold">{row.name}</span>
            <Pill className={STAGE_CLS[stage]}>{STAGE_LABEL[stage]}</Pill>
            {asked && (
              <Pill className="bg-ipe/25 text-foreground">
                <BellRing className="size-3" /> Pediu ajuda{' '}
                {o?.ownerInterestAt ? `em ${formatDateTime(o.ownerInterestAt)}` : ''}
              </Pill>
            )}
            {due && (
              <Pill className="bg-destructive/10 text-destructive">
                <CalendarClock className="size-3" /> Retorno {formatISODate(o!.nextContact!)}
              </Pill>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {row.city}/{row.state} · {money(row.volume)} <Delta v={row.deltaPct} /> · {row.bookings}{' '}
            reservas · ocupação {row.occupancy.toLocaleString('pt-BR')}%
          </p>
        </div>
        <Pill className={REC_STYLE[d.recommendation].cls}>
          <RecIcon className="size-3.5" /> {RECOMMENDATION_LABEL[d.recommendation]}
        </Pill>
        <div className="flex w-28 items-center gap-2" title={`Prioridade ${d.priority} de 100`}>
          <span className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full">
            <span
              className={`block h-full rounded-full ${d.priority >= 60 ? 'bg-destructive' : d.priority >= 30 ? 'bg-ipe/150' : 'bg-success/100'}`}
              style={{ width: `${Math.max(4, d.priority)}%` }}
            />
          </span>
          <span className="text-muted-foreground w-6 text-right text-xs tabular-nums">
            {d.priority}
          </span>
        </div>
        <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-border grid gap-6 border-t p-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="text-foreground text-sm font-semibold">Diagnóstico</p>
            <p className="text-foreground mt-1 text-sm">{d.reason}</p>
            {d.issues.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.issues.map((iss) => (
                  <Pill
                    key={iss.key}
                    className={
                      iss.blocks
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-ipe/20 text-foreground'
                    }
                  >
                    {iss.blocks && <AlertTriangle className="size-3" />} {iss.label}
                  </Pill>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ['Volume', money(row.volume)],
              ['Ticket', row.avgTicket ? money(row.avgTicket) : '—'],
              ['Quartos', String(row.rooms)],
              [
                'Nota',
                row.rating !== null
                  ? `${row.rating.toLocaleString('pt-BR')} (${row.reviews})`
                  : '—',
              ],
            ].map(([k, v]) => (
              <div key={k} className="bg-secondary/50 rounded-lg p-2">
                <div className="text-muted-foreground text-[11px]">{k}</div>
                <div className="text-foreground font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <ContactBox item={item} wa={wa} />
        </div>
        <div className="space-y-4">
          <OpportunityForm item={item} />
          <Timeline item={item} />
        </div>
      </div>
    </details>
  )
}

function ContactBox({ item, wa }: { item: GrowthItem; wa: string | null }) {
  const [copied, setCopied] = useState(false)
  const p = item.profile
  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-foreground text-sm font-semibold">Contato</p>
      <p className="text-foreground mt-1 text-sm">
        {p?.ownerName || 'Proprietário sem nome'}
        {p?.ownerEmail && <span className="text-muted-foreground"> · {p.ownerEmail}</span>}
      </p>
      <p className="text-muted-foreground text-sm">
        {p?.whatsapp || p?.phone || 'Telefone não cadastrado'}
      </p>
      <p className="bg-secondary/50 text-foreground mt-2 rounded-lg p-2 text-xs leading-relaxed">
        {item.offerText}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {wa && (
          <a
            href={`${wa}?text=${encodeURIComponent(item.offerText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-success text-success-foreground inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            <MessageCircle className="size-3.5" /> Abrir no WhatsApp
          </a>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(item.offerText)
            } catch {
              /* sem clipboard */
            }
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="border-border inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
        >
          <Copy className="size-3.5" /> {copied ? 'Copiado' : 'Copiar mensagem'}
        </button>
      </div>
    </div>
  )
}

function OpportunityForm({ item }: { item: GrowthItem }) {
  const router = useRouter()
  const o = item.opportunity
  const [f, setF] = useState({
    stage: (o?.stage ?? 'a_oferecer') as GrowthStage,
    serviceFee: o?.serviceFee?.toString() ?? '',
    adBudget: o?.adBudget?.toString() ?? '',
    nextContact: o?.nextContact ?? '',
    campaignStart: o?.campaignStart ?? '',
    campaignEnd: o?.campaignEnd ?? '',
    lostReason: o?.lostReason ?? '',
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const id = item.row.id
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  async function save() {
    setMsg(null)
    setPending(true)
    try {
      const res = await saveOpportunityAction({
        pousadaId: id,
        stage: f.stage,
        serviceFee: f.serviceFee,
        adBudget: f.adBudget,
        nextContact: f.nextContact || null,
        campaignStart: f.campaignStart || null,
        campaignEnd: f.campaignEnd || null,
        lostReason: f.lostReason,
      })
      if (!res.ok)
        setMsg({
          ok: false,
          text: res.fieldErrors ? Object.values(res.fieldErrors)[0]! : res.error,
        })
      else {
        setMsg({ ok: true, text: 'Salvo.' })
        router.refresh()
      }
    } catch {
      setMsg({ ok: false, text: 'Não foi possível salvar. Tente de novo.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-foreground mb-2 text-sm font-semibold">Oferta de tráfego pago</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Etapa</span>
          <select id={`stage-${id}`} value={f.stage} onChange={set('stage')} className={inputCls}>
            {GROWTH_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Próximo contato</span>
          <input
            id={`next-${id}`}
            type="date"
            value={f.nextContact}
            onChange={set('nextContact')}
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Mensalidade do serviço (R$)</span>
          <input
            id={`fee-${id}`}
            inputMode="decimal"
            value={f.serviceFee}
            onChange={set('serviceFee')}
            placeholder="Ex.: 497"
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Verba mensal de anúncio (R$)</span>
          <input
            id={`budget-${id}`}
            inputMode="decimal"
            value={f.adBudget}
            onChange={set('adBudget')}
            placeholder="Ex.: 600"
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Início da campanha</span>
          <input
            id={`start-${id}`}
            type="date"
            value={f.campaignStart}
            onChange={set('campaignStart')}
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">Fim da campanha</span>
          <input
            id={`end-${id}`}
            type="date"
            value={f.campaignEnd}
            onChange={set('campaignEnd')}
            className={inputCls}
          />
        </label>
        {f.stage === 'recusado' && (
          <label className="grid gap-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">Motivo da recusa</span>
            <input
              id={`lost-${id}`}
              value={f.lostReason}
              onChange={set('lostReason')}
              maxLength={300}
              placeholder="Ex.: sem verba agora, pediu para voltar em março"
              className={inputCls}
            />
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="bg-ocean rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Salvando…' : 'Salvar'}
        </button>
        {msg && (
          <span
            role={msg.ok ? 'status' : 'alert'}
            className={`text-xs font-medium ${msg.ok ? 'text-success' : 'text-destructive'}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  )
}

function Timeline({ item }: { item: GrowthItem }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function add(kind: 'nota' | 'contato') {
    setErr(null)
    setPending(true)
    try {
      const res = await addActivityAction({ pousadaId: item.row.id, kind, body: text })
      if (!res.ok) setErr(res.fieldErrors ? Object.values(res.fieldErrors)[0]! : res.error)
      else {
        setText('')
        router.refresh()
      }
    } catch {
      setErr('Não foi possível salvar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  const KIND: Record<string, string> = {
    nota: 'Nota',
    contato: 'Contato',
    etapa: 'Etapa',
    interesse: 'Pousada',
  }
  return (
    <div className="border-border rounded-xl border p-3">
      <p className="text-foreground mb-2 text-sm font-semibold">Histórico</p>
      <textarea
        id={`note-${item.row.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Ex.: Liguei, pediu proposta por e-mail. Retornar sexta."
        className={`${inputCls} resize-none`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() => void add('contato')}
          className="bg-foreground text-background rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          Registrar contato
        </button>
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() => void add('nota')}
          className="border-border rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          Adicionar nota
        </button>
        {err && (
          <span role="alert" className="text-destructive text-xs font-medium">
            {err}
          </span>
        )}
      </div>
      {item.activities.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs">Nenhum registro ainda.</p>
      ) : (
        <ol className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {item.activities.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="text-muted-foreground text-xs">
                {formatDateTime(a.createdAt)} · {KIND[a.kind] ?? a.kind}
                {a.author ? ` · ${a.author}` : ''}
              </span>
              <p className="text-foreground">{a.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
