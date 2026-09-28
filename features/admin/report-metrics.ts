/**
 * Cálculos da tela "Relatórios" do painel master — funções puras (sem banco),
 * testadas em report-metrics.test.ts. O repositório busca as linhas cruas e
 * isto transforma em indicadores, séries e rankings.
 *
 * Bases de data (explicadas também na tela):
 * - Vendas (volume, reservas, ticket, canais, cancelamento, antecedência):
 *   reservas CRIADAS no período.
 * - Ocupação: noites HOSPEDADAS dentro do período (a estadia é recortada nas
 *   bordas), sobre quartos das pousadas publicadas × dias do período.
 */

export const REPORT_PERIODS = ['30d', '90d', '6m', '12m', '24m'] as const
export type ReportPeriod = (typeof REPORT_PERIODS)[number]

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  '30d': '30 dias',
  '90d': '90 dias',
  '6m': '6 meses',
  '12m': '12 meses',
  '24m': '24 meses',
}

export const REVENUE_STATUSES = ['confirmed', 'checked_in', 'checked_out'] as const
const LOST_STATUSES = ['cancelled', 'no_show']

export type MacroRegion = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul'
export const MACRO_REGIONS: MacroRegion[] = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte']

const UF_REGION: Record<string, MacroRegion> = {
  AC: 'Norte',
  AP: 'Norte',
  AM: 'Norte',
  PA: 'Norte',
  RO: 'Norte',
  RR: 'Norte',
  TO: 'Norte',
  AL: 'Nordeste',
  BA: 'Nordeste',
  CE: 'Nordeste',
  MA: 'Nordeste',
  PB: 'Nordeste',
  PE: 'Nordeste',
  PI: 'Nordeste',
  RN: 'Nordeste',
  SE: 'Nordeste',
  DF: 'Centro-Oeste',
  GO: 'Centro-Oeste',
  MT: 'Centro-Oeste',
  MS: 'Centro-Oeste',
  ES: 'Sudeste',
  MG: 'Sudeste',
  RJ: 'Sudeste',
  SP: 'Sudeste',
  PR: 'Sul',
  RS: 'Sul',
  SC: 'Sul',
}

export function regionOf(uf: string): MacroRegion | null {
  return UF_REGION[uf.trim().toUpperCase()] ?? null
}

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------
export type DateWindow = { start: Date; end: Date; days: number }

/** Janela atual [start, end) terminando no fim de hoje (UTC) e a anterior de mesmo tamanho. */
export function periodWindows(period: ReportPeriod, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const start = new Date(end)
  if (period.endsWith('d')) start.setUTCDate(start.getUTCDate() - Number(period.slice(0, -1)))
  else start.setUTCMonth(start.getUTCMonth() - Number(period.slice(0, -1)))
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  const prevStart = new Date(start.getTime() - days * 86_400_000)
  return {
    current: { start, end, days } as DateWindow,
    previous: { start: prevStart, end: start, days } as DateWindow,
  }
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10)
}

function dayMs(iso: string) {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
}

export function nights(checkin: string, checkout: string) {
  return Math.max(0, Math.round((dayMs(checkout) - dayMs(checkin)) / 86_400_000))
}

/** Noites da estadia que caem dentro de [start, end). */
export function nightsInside(checkin: string, checkout: string, w: DateWindow) {
  const a = Math.max(dayMs(checkin), w.start.getTime())
  const b = Math.min(dayMs(checkout), w.end.getTime())
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

// ---------------------------------------------------------------------------
// Linhas cruas
// ---------------------------------------------------------------------------
export type ReportBooking = {
  pousadaId: string
  status: string
  origin: string
  total: number
  checkin: string
  checkout: string
  createdAt: string
}
export type ReportPousada = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  status: string
  createdAt: string
}
export type ReportReview = { pousadaId: string; rating: number; createdAt: string }

export type ReportInput = {
  period: ReportPeriod
  now?: Date
  /** Reservas criadas desde o início do período anterior. */
  sales: ReportBooking[]
  /** Reservas (status de receita) com estadia tocando o período atual ou o anterior. */
  stays: ReportBooking[]
  pousadas: ReportPousada[]
  roomsByPousada: Record<string, number>
  reviews: ReportReview[]
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------
export type Metric = { value: number; previous: number; deltaPct: number | null }

export type ReportKpis = {
  volume: Metric
  bookings: Metric
  nightsSold: Metric
  avgTicket: Metric
  occupancy: Metric
  cancelRate: Metric
  leadTimeDays: Metric
  avgStay: Metric
  rating: { value: number | null; count: number }
  activePousadas: number
  pousadasWithSales: number
}

export type SeriesPoint = { key: string; label: string; volume: number; bookings: number }

export type GroupRow = {
  key: string
  label: string
  region: MacroRegion | null
  pousadas: number
  volume: number
  volumePrev: number
  deltaPct: number | null
  bookings: number
  nights: number
  occupancy: number
  avgTicket: number
}

export type PousadaStatus =
  'crescendo' | 'caindo' | 'sem_resultado' | 'nova' | 'estavel' | 'sem_quartos'

export type PousadaRow = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  region: MacroRegion | null
  rooms: number
  volume: number
  volumePrev: number
  deltaPct: number | null
  bookings: number
  nights: number
  occupancy: number
  avgTicket: number
  cancelRate: number
  rating: number | null
  reviews: number
  status: PousadaStatus
}

export type ShareRow = { key: string; label: string; count: number; volume: number; share: number }

export type ReportData = {
  period: ReportPeriod
  window: { start: string; end: string; days: number }
  kpis: ReportKpis
  series: SeriesPoint[]
  regions: GroupRow[]
  states: GroupRow[]
  cities: GroupRow[]
  pousadas: PousadaRow[]
  origins: ShareRow[]
  statuses: ShareRow[]
  weekdays: { label: string; count: number }[]
  alerts: {
    kind: 'sem_resultado' | 'caindo' | 'sem_quartos' | 'ocupacao_baixa' | 'cancelamento'
    pousada: string
    detail: string
  }[]
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function metric(value: number, previous: number): Metric {
  return { value, previous, deltaPct: deltaPct(value, previous) }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, round1((a / b) * 100)) : 0)

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function inWindow(iso: string, w: DateWindow) {
  const t = Date.parse(iso)
  return t >= w.start.getTime() && t < w.end.getTime()
}

type Acc = {
  volume: number
  volumePrev: number
  bookings: number
  lost: number
  all: number
  nights: number
}
const newAcc = (): Acc => ({ volume: 0, volumePrev: 0, bookings: 0, lost: 0, all: 0, nights: 0 })

export function buildReport(input: ReportInput): ReportData {
  const { current: cur, previous: prev } = periodWindows(input.period, input.now)
  const pousadaById = new Map(input.pousadas.map((p) => [p.id, p]))
  const published = input.pousadas.filter((p) => p.status === 'publicada')
  const isRevenue = (s: string) => (REVENUE_STATUSES as readonly string[]).includes(s)

  // ---- vendas
  const salesCur = input.sales.filter((b) => inWindow(b.createdAt, cur) && b.status !== 'quote')
  const salesPrev = input.sales.filter((b) => inWindow(b.createdAt, prev) && b.status !== 'quote')
  const revCur = salesCur.filter((b) => isRevenue(b.status))
  const revPrev = salesPrev.filter((b) => isRevenue(b.status))
  const sum = (xs: ReportBooking[]) => xs.reduce((s, b) => s + Number(b.total || 0), 0)
  const nightsOf = (xs: ReportBooking[]) =>
    xs.reduce((s, b) => s + nights(b.checkin, b.checkout), 0)
  const lead = (xs: ReportBooking[]) =>
    xs.length
      ? round1(
          xs.reduce(
            (s, b) => s + Math.max(0, (dayMs(b.checkin) - Date.parse(b.createdAt)) / 86_400_000),
            0,
          ) / xs.length,
        )
      : 0
  const lostRate = (xs: ReportBooking[]) =>
    pct(xs.filter((b) => LOST_STATUSES.includes(b.status)).length, xs.length)

  // ---- ocupação (noites hospedadas no período)
  const roomsPublished = published.reduce((s, p) => s + (input.roomsByPousada[p.id] ?? 0), 0)
  const stayedCur = input.stays.reduce((s, b) => s + nightsInside(b.checkin, b.checkout, cur), 0)
  const stayedPrev = input.stays.reduce((s, b) => s + nightsInside(b.checkin, b.checkout, prev), 0)

  // ---- avaliações
  const revs = input.reviews.filter((r) => inWindow(r.createdAt, cur))
  const ratingAvg = revs.length
    ? round1(revs.reduce((s, r) => s + r.rating, 0) / revs.length)
    : null

  const volumeCur = sum(revCur)
  const volumePrev = sum(revPrev)
  const kpis: ReportKpis = {
    volume: metric(volumeCur, volumePrev),
    bookings: metric(revCur.length, revPrev.length),
    nightsSold: metric(nightsOf(revCur), nightsOf(revPrev)),
    avgTicket: metric(
      revCur.length ? Math.round(volumeCur / revCur.length) : 0,
      revPrev.length ? Math.round(volumePrev / revPrev.length) : 0,
    ),
    occupancy: metric(
      pct(stayedCur, roomsPublished * cur.days),
      pct(stayedPrev, roomsPublished * prev.days),
    ),
    cancelRate: metric(lostRate(salesCur), lostRate(salesPrev)),
    leadTimeDays: metric(lead(revCur), lead(revPrev)),
    avgStay: metric(
      revCur.length ? round1(nightsOf(revCur) / revCur.length) : 0,
      revPrev.length ? round1(nightsOf(revPrev) / revPrev.length) : 0,
    ),
    rating: { value: ratingAvg, count: revs.length },
    activePousadas: published.length,
    pousadasWithSales: new Set(revCur.map((b) => b.pousadaId)).size,
  }

  // ---- série (semanas até 90 dias; meses acima)
  const byWeek = cur.days <= 92
  const buckets = new Map<string, SeriesPoint>()
  if (byWeek) {
    for (let t = cur.start.getTime(); t < cur.end.getTime(); t += 7 * 86_400_000) {
      const d = new Date(t)
      const key = isoDay(d)
      buckets.set(key, {
        key,
        label: `${d.getUTCDate()}/${MONTHS[d.getUTCMonth()]}`,
        volume: 0,
        bookings: 0,
      })
    }
  } else {
    const d = new Date(Date.UTC(cur.start.getUTCFullYear(), cur.start.getUTCMonth(), 1))
    while (d < cur.end) {
      const key = d.toISOString().slice(0, 7)
      buckets.set(key, {
        key,
        label: `${MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`,
        volume: 0,
        bookings: 0,
      })
      d.setUTCMonth(d.getUTCMonth() + 1)
    }
  }
  const keys = [...buckets.keys()]
  for (const b of revCur) {
    let key: string | undefined
    if (byWeek) {
      const idx = Math.floor((Date.parse(b.createdAt) - cur.start.getTime()) / (7 * 86_400_000))
      key = keys[Math.min(Math.max(idx, 0), keys.length - 1)]
    } else key = b.createdAt.slice(0, 7)
    const bucket = key ? buckets.get(key) : undefined
    if (bucket) {
      bucket.volume += Number(b.total || 0)
      bucket.bookings += 1
    }
  }

  // ---- por pousada
  const accP = new Map<string, Acc>()
  const acc = (id: string) => {
    let a = accP.get(id)
    if (!a) accP.set(id, (a = newAcc()))
    return a
  }
  for (const b of salesCur) {
    const a = acc(b.pousadaId)
    a.all += 1
    if (LOST_STATUSES.includes(b.status)) a.lost += 1
    if (isRevenue(b.status)) {
      a.volume += Number(b.total || 0)
      a.bookings += 1
    }
  }
  for (const b of revPrev) acc(b.pousadaId).volumePrev += Number(b.total || 0)
  for (const b of input.stays) {
    const n = nightsInside(b.checkin, b.checkout, cur)
    if (n) acc(b.pousadaId).nights += n
  }
  const ratingBy = new Map<string, { sum: number; n: number }>()
  for (const r of input.reviews) {
    const x = ratingBy.get(r.pousadaId) ?? { sum: 0, n: 0 }
    x.sum += r.rating
    x.n += 1
    ratingBy.set(r.pousadaId, x)
  }

  const nowMs = (input.now ?? new Date()).getTime()
  const pousadas: PousadaRow[] = published.map((p) => {
    const a = accP.get(p.id) ?? newAcc()
    const rooms = input.roomsByPousada[p.id] ?? 0
    const ageDays = (nowMs - Date.parse(p.createdAt)) / 86_400_000
    const d = deltaPct(a.volume, a.volumePrev)
    const r = ratingBy.get(p.id)
    let status: PousadaStatus = 'estavel'
    if (rooms === 0) status = 'sem_quartos'
    else if (ageDays < 30) status = 'nova'
    else if (a.bookings === 0) status = 'sem_resultado'
    else if (d !== null && d <= -20) status = 'caindo'
    else if (d === null || d >= 20) status = 'crescendo'
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      city: p.city,
      state: p.state,
      region: regionOf(p.state),
      rooms,
      volume: a.volume,
      volumePrev: a.volumePrev,
      deltaPct: d,
      bookings: a.bookings,
      nights: a.nights,
      occupancy: pct(a.nights, rooms * cur.days),
      avgTicket: a.bookings ? Math.round(a.volume / a.bookings) : 0,
      cancelRate: pct(a.lost, a.all),
      rating: r ? round1(r.sum / r.n) : null,
      reviews: r?.n ?? 0,
      status,
    }
  })
  pousadas.sort(
    (x, y) => y.volume - x.volume || y.bookings - x.bookings || x.name.localeCompare(y.name),
  )

  // ---- agrupamentos (região, UF, cidade)
  function group(
    keyOf: (p: PousadaRow) => { key: string; label: string; region: MacroRegion | null } | null,
  ) {
    const m = new Map<string, GroupRow & { rooms: number }>()
    for (const p of pousadas) {
      const k = keyOf(p)
      if (!k) continue
      const g =
        m.get(k.key) ??
        ({
          ...k,
          pousadas: 0,
          volume: 0,
          volumePrev: 0,
          deltaPct: null,
          bookings: 0,
          nights: 0,
          occupancy: 0,
          avgTicket: 0,
          rooms: 0,
        } as GroupRow & { rooms: number })
      g.pousadas += 1
      g.volume += p.volume
      g.volumePrev += p.volumePrev
      g.bookings += p.bookings
      g.nights += p.nights
      g.rooms += p.rooms
      m.set(k.key, g)
    }
    return [...m.values()]
      .map(({ rooms, ...g }) => ({
        ...g,
        deltaPct: deltaPct(g.volume, g.volumePrev),
        occupancy: pct(g.nights, rooms * cur.days),
        avgTicket: g.bookings ? Math.round(g.volume / g.bookings) : 0,
      }))
      .sort(
        (a, b) => b.volume - a.volume || b.bookings - a.bookings || a.label.localeCompare(b.label),
      )
  }
  const regions = group((p) =>
    p.region
      ? { key: p.region, label: p.region, region: p.region }
      : { key: 'outra', label: 'Sem UF', region: null },
  )
  // Todas as macrorregiões aparecem (mesmo zeradas), na ordem fixa — cor segue a região, não o ranking.
  const regionsFull: GroupRow[] = MACRO_REGIONS.map(
    (r) =>
      regions.find((g) => g.key === r) ?? {
        key: r,
        label: r,
        region: r,
        pousadas: 0,
        volume: 0,
        volumePrev: 0,
        deltaPct: 0,
        bookings: 0,
        nights: 0,
        occupancy: 0,
        avgTicket: 0,
      },
  )
  const states = group((p) => ({ key: p.state || '—', label: p.state || '—', region: p.region }))
  const cities = group((p) => ({
    key: `${p.city}/${p.state}`,
    label: `${p.city}/${p.state}`,
    region: p.region,
  }))

  // ---- canais e status
  const share = (
    xs: ReportBooking[],
    keyOf: (b: ReportBooking) => string,
    onlyRevenueVolume = true,
  ): ShareRow[] => {
    const m = new Map<string, ShareRow>()
    for (const b of xs) {
      const k = keyOf(b)
      const row = m.get(k) ?? { key: k, label: k, count: 0, volume: 0, share: 0 }
      row.count += 1
      if (!onlyRevenueVolume || isRevenue(b.status)) row.volume += Number(b.total || 0)
      m.set(k, row)
    }
    const total = xs.length
    return [...m.values()]
      .map((r) => ({ ...r, share: pct(r.count, total) }))
      .sort((a, b) => b.count - a.count)
  }
  const origins = share(revCur, (b) => b.origin || 'outro')
  const statuses = share(
    input.sales.filter((b) => inWindow(b.createdAt, cur)),
    (b) => b.status,
    false,
  )

  // ---- dia da semana do check-in (reservas vendidas no período)
  const wd = WEEKDAYS.map((label) => ({ label, count: 0 }))
  for (const b of revCur) wd[new Date(dayMs(b.checkin)).getUTCDay()]!.count += 1

  // ---- alertas (uma linha por pousada, juntando os motivos)
  const br = (n: number, d = 0) => n.toLocaleString('pt-BR', { maximumFractionDigits: d })
  const alerts: ReportData['alerts'] = []
  for (const p of pousadas) {
    const pp = pousadaById.get(p.id)!
    const reasons: string[] = []
    let kind: ReportData['alerts'][number]['kind'] | null = null
    if (p.status === 'sem_quartos') {
      kind = 'sem_quartos'
      reasons.push('publicada sem acomodação ativa, não aparece na busca')
    } else if (p.status === 'sem_resultado') {
      kind = 'sem_resultado'
      reasons.push(`nenhuma reserva nos últimos ${PERIOD_LABEL[input.period]}`)
    } else if (p.status === 'caindo') {
      kind = 'caindo'
      reasons.push(`volume caiu ${br(Math.abs(p.deltaPct ?? 0))}% sobre o período anterior`)
    }
    if (p.bookings >= 3 && p.cancelRate >= 30) {
      kind ??= 'cancelamento'
      reasons.push(`${br(p.cancelRate)}% de cancelamento ou não comparecimento`)
    }
    if (
      p.rooms > 0 &&
      p.status !== 'nova' &&
      p.bookings > 0 &&
      p.occupancy < 15 &&
      reasons.length > 0
    ) {
      reasons.push(`ocupação de ${br(p.occupancy, 1)}%`)
    }
    if (kind) {
      const detail = reasons.join(' · ')
      alerts.push({
        kind,
        pousada: pp.name,
        detail: detail.charAt(0).toUpperCase() + detail.slice(1) + '.',
      })
    }
  }
  const severity = {
    sem_quartos: 0,
    sem_resultado: 1,
    caindo: 2,
    cancelamento: 3,
    ocupacao_baixa: 4,
  }
  alerts.sort((x, y) => severity[x.kind] - severity[y.kind])

  return {
    period: input.period,
    window: {
      start: isoDay(cur.start),
      end: isoDay(new Date(cur.end.getTime() - 86_400_000)),
      days: cur.days,
    },
    kpis,
    series: [...buckets.values()],
    regions: regionsFull,
    states,
    cities,
    pousadas,
    origins,
    statuses,
    weekdays: wd,
    alerts,
  }
}
