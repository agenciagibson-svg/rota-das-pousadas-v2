/**
 * Plano de ação comercial (painel master): diagnóstico de cada pousada,
 * recomendação (arrumar perfil, oferecer tráfego pago, acompanhar) e
 * resultado das campanhas (antes x depois). Funções puras — testadas em
 * growth.test.ts. Banco: 0080_plano_acao_trafego.sql.
 */
import { nights, nightsInside, type PousadaRow, type ReportBooking } from './report-metrics'

export const GROWTH_STAGES = [
  'a_oferecer',
  'oferecido',
  'interessado',
  'aceito',
  'campanha_ativa',
  'encerrado',
  'recusado',
] as const
export type GrowthStage = (typeof GROWTH_STAGES)[number]

export const STAGE_LABEL: Record<GrowthStage, string> = {
  a_oferecer: 'A oferecer',
  oferecido: 'Oferecido',
  interessado: 'Interessado',
  aceito: 'Aceito',
  campanha_ativa: 'Campanha ativa',
  encerrado: 'Encerrado',
  recusado: 'Recusado',
}

export type GrowthProfile = {
  pousadaId: string
  photos: number
  hasCover: boolean
  descriptionLen: number
  hasMercadoPago: boolean
  hasPix: boolean
  activeRooms: number
  reviewsCount: number
  ownerName: string | null
  ownerEmail: string | null
  whatsapp: string | null
  phone: string | null
}

export type Opportunity = {
  pousadaId: string
  stage: GrowthStage
  serviceFee: number | null
  adBudget: number | null
  nextContact: string | null
  campaignStart: string | null
  campaignEnd: string | null
  ownerInterestAt: string | null
  lostReason: string
  updatedAt: string | null
}

export type Activity = {
  id: string
  pousadaId: string
  kind: 'nota' | 'contato' | 'etapa' | 'interesse'
  body: string
  author: string | null
  createdAt: string
}

export type Issue = { key: string; label: string; blocks: boolean }

export type Recommendation = 'arrumar_perfil' | 'trafego' | 'acompanhar'

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  arrumar_perfil: 'Arrumar o perfil antes de anunciar',
  trafego: 'Oferecer tráfego pago',
  acompanhar: 'Acompanhar',
}

export type Diagnosis = {
  issues: Issue[]
  recommendation: Recommendation
  /** 0 a 100: quanto maior, mais urgente falar com a pousada. */
  priority: number
  reason: string
}

export const MIN_PHOTOS = 5
export const MIN_DESCRIPTION = 200

/** Problemas do perfil. Os que "bloqueiam" fazem o anúncio desperdiçar dinheiro. */
export function profileIssues(p: GrowthProfile): Issue[] {
  const issues: Issue[] = []
  if (p.activeRooms === 0)
    issues.push({ key: 'quartos', label: 'Sem acomodação ativa', blocks: true })
  if (p.photos < 3) issues.push({ key: 'fotos', label: `Só ${p.photos} foto(s)`, blocks: true })
  else if (p.photos < MIN_PHOTOS)
    issues.push({ key: 'fotos', label: `Poucas fotos (${p.photos})`, blocks: false })
  if (!p.hasCover) issues.push({ key: 'capa', label: 'Sem foto de capa', blocks: true })
  if (!p.hasMercadoPago && !p.hasPix)
    issues.push({ key: 'pagamento', label: 'Sem pagamento online', blocks: true })
  if (p.descriptionLen < MIN_DESCRIPTION)
    issues.push({ key: 'descricao', label: 'Descrição curta', blocks: false })
  if (p.reviewsCount === 0)
    issues.push({ key: 'avaliacoes', label: 'Sem avaliações', blocks: false })
  return issues
}

export function diagnose(
  row: PousadaRow,
  profile: GrowthProfile,
  opp: Opportunity | null,
): Diagnosis {
  const issues = profileIssues(profile)
  const blocked = issues.some((i) => i.blocks)
  const weakSales =
    row.status === 'sem_resultado' ||
    row.status === 'caindo' ||
    (row.rooms > 0 && row.occupancy < 40)

  let priority = 0
  if (row.status === 'sem_resultado') priority += 55
  else if (row.status === 'caindo') priority += 40
  if (row.occupancy < 20) priority += 20
  else if (row.occupancy < 40) priority += 10
  if (row.status === 'nova') priority += 10
  if (opp?.ownerInterestAt && ['a_oferecer', 'oferecido', 'interessado'].includes(opp.stage))
    priority += 35
  if (blocked) priority -= 10
  priority = Math.max(0, Math.min(100, priority))

  let recommendation: Recommendation
  let reason: string
  if (blocked) {
    recommendation = 'arrumar_perfil'
    reason = `Antes do anúncio: ${issues
      .filter((i) => i.blocks)
      .map((i) => i.label.toLowerCase())
      .join(', ')}.`
  } else if (weakSales) {
    recommendation = 'trafego'
    reason =
      row.status === 'sem_resultado'
        ? 'Perfil pronto, mas sem reservas no período: o anúncio traz as primeiras vendas.'
        : row.status === 'caindo'
          ? `Vendas caíram ${Math.abs(row.deltaPct ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%: o anúncio recupera o volume.`
          : `Ocupação de ${row.occupancy.toLocaleString('pt-BR')}%: há quartos vazios para vender.`
  } else {
    recommendation = 'acompanhar'
    reason = 'Vendendo bem. Ofereça anúncio para a baixa temporada ou para datas vazias.'
  }
  return { issues, recommendation, priority, reason }
}

// ---------------------------------------------------------------------------
// Resultado da campanha: janela depois do início x mesma duração antes.
// ---------------------------------------------------------------------------
export type Window = { bookings: number; volume: number; nights: number; occupancy: number }
export type CampaignResult = {
  days: number
  before: Window
  after: Window
  volumeDeltaPct: number | null
  bookingsDelta: number
  /** Serviço + verba no período (proporcional aos dias). */
  investment: number
  /** Volume a mais depois da campanha ÷ investimento (quantas vezes voltou). */
  returnMultiple: number | null
}

const DAY = 86_400_000
const d0 = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
const REVENUE = ['confirmed', 'checked_in', 'checked_out']

export function campaignResults(input: {
  bookings: ReportBooking[]
  rooms: number
  start: string
  end: string | null
  today: string
  serviceFee: number | null
  adBudget: number | null
}): { elapsedDays: number; checkpoints: CampaignResult[] } {
  const start = d0(input.start)
  const stop = Math.min(d0(input.today) + DAY, input.end ? d0(input.end) + DAY : Infinity)
  const elapsedDays = Math.max(0, Math.round((stop - start) / DAY))
  const monthly = (input.serviceFee ?? 0) + (input.adBudget ?? 0)
  const windows = [30, 60, 90].filter((w) => w <= elapsedDays)
  if (elapsedDays > 0 && !windows.includes(elapsedDays) && elapsedDays < 90)
    windows.push(elapsedDays)

  const measure = (from: number, to: number): Window => {
    const sold = input.bookings.filter(
      (b) =>
        REVENUE.includes(b.status) &&
        Date.parse(b.createdAt) >= from &&
        Date.parse(b.createdAt) < to,
    )
    const w = { start: new Date(from), end: new Date(to), days: Math.round((to - from) / DAY) }
    const stayed = input.bookings
      .filter((b) => REVENUE.includes(b.status))
      .reduce((s, b) => s + nightsInside(b.checkin, b.checkout, w), 0)
    const cap = input.rooms * w.days
    return {
      bookings: sold.length,
      volume: sold.reduce((s, b) => s + (Number(b.total) || 0), 0),
      nights: sold.reduce((s, b) => s + nights(b.checkin, b.checkout), 0),
      occupancy: cap > 0 ? Math.min(100, Math.round((stayed / cap) * 1000) / 10) : 0,
    }
  }

  const checkpoints = windows
    .sort((a, b) => a - b)
    .map((days): CampaignResult => {
      const after = measure(start, start + days * DAY)
      const before = measure(start - days * DAY, start)
      const investment = Math.round(monthly * (days / 30))
      const gain = after.volume - before.volume
      return {
        days,
        before,
        after,
        volumeDeltaPct:
          before.volume > 0
            ? Math.round(((after.volume - before.volume) / before.volume) * 1000) / 10
            : null,
        bookingsDelta: after.bookings - before.bookings,
        investment,
        returnMultiple: investment > 0 ? Math.round((gain / investment) * 10) / 10 : null,
      }
    })
  return { elapsedDays, checkpoints }
}

/** Mensagem pronta para o primeiro contato pelo WhatsApp. */
export function offerMessage(ownerName: string | null, pousadaName: string, d: Diagnosis) {
  const hi = ownerName ? `Olá, ${ownerName.split(' ')[0]}!` : 'Olá!'
  const why =
    d.recommendation === 'arrumar_perfil'
      ? 'Vi alguns ajustes no perfil que podem aumentar suas reservas e quero te ajudar com eles.'
      : 'Olhei os números da pousada e vejo espaço para vender mais com anúncios direcionados (tráfego pago) levando viajantes direto para a sua página de reserva.'
  return `${hi} Aqui é da Rota das Pousadas. ${why} Posso te mostrar como funcionaria para a ${pousadaName}?`
}
