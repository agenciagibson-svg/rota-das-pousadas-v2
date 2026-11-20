/**
 * Feriados nacionais e o "feriadão" sugerido para viajar.
 *
 * Datas fixas (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023 — Consciência
 * Negra) e móveis a partir da Páscoa: Carnaval (ponto facultativo nacional,
 * mas folga na prática), Sexta-feira Santa e Corpus Christi (ponto
 * facultativo). Feriado estadual e municipal fica de fora.
 *
 * Tudo em datas civis "AAAA-MM-DD", sem fuso: não há hora envolvida.
 */

export type Holiday = {
  slug: string
  name: string
  /** Dia do feriado (para o Carnaval, a terça). */
  date: string
}

export type LongWeekend = Holiday & {
  /** Primeiro e último dia de folga (inclui fim de semana e emenda). */
  offStart: string
  offEnd: string
  /** Sugestão de hospedagem: chega na véspera da folga, sai no último dia. */
  checkin: string
  checkout: string
  nights: number
  /** Precisa emendar um dia útil (feriado na terça ou na quinta). */
  bridge: boolean
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

export function addDays(date: string, days: number): string {
  const t = toUTC(date)
  t.setUTCDate(t.getUTCDate() + days)
  return t.toISOString().slice(0, 10)
}

/** 0 = domingo … 6 = sábado. */
export function weekday(date: string): number {
  return toUTC(date).getUTCDay()
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easter(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(year, month, day)
}

export function holidaysOf(year: number): Holiday[] {
  const e = easter(year)
  return [
    { slug: 'ano-novo', name: 'Ano Novo', date: iso(year, 1, 1) },
    { slug: 'carnaval', name: 'Carnaval', date: addDays(e, -47) },
    { slug: 'sexta-feira-santa', name: 'Sexta-feira Santa', date: addDays(e, -2) },
    { slug: 'tiradentes', name: 'Tiradentes', date: iso(year, 4, 21) },
    { slug: 'dia-do-trabalho', name: 'Dia do Trabalho', date: iso(year, 5, 1) },
    { slug: 'corpus-christi', name: 'Corpus Christi', date: addDays(e, 60) },
    { slug: 'independencia', name: 'Independência do Brasil', date: iso(year, 9, 7) },
    { slug: 'nossa-senhora-aparecida', name: 'Nossa Senhora Aparecida', date: iso(year, 10, 12) },
    { slug: 'finados', name: 'Finados', date: iso(year, 11, 2) },
    {
      slug: 'proclamacao-da-republica',
      name: 'Proclamação da República',
      date: iso(year, 11, 15),
    },
    { slug: 'consciencia-negra', name: 'Dia da Consciência Negra', date: iso(year, 11, 20) },
    { slug: 'natal', name: 'Natal', date: iso(year, 12, 25) },
  ].sort((a, b) => a.date.localeCompare(b.date))
}

/** Folga em volta do feriado, com a emenda quando ele cai na terça ou na quinta. */
export function longWeekend(h: Holiday): LongWeekend {
  let offStart = h.date
  let offEnd = h.date
  let bridge = false
  if (h.slug === 'carnaval') {
    // Sábado a terça de Carnaval.
    offStart = addDays(h.date, -3)
  } else {
    switch (weekday(h.date)) {
      case 1: // segunda
        offStart = addDays(h.date, -2)
        break
      case 2: // terça: emenda a segunda
        offStart = addDays(h.date, -3)
        bridge = true
        break
      case 4: // quinta: emenda a sexta
        offEnd = addDays(h.date, 3)
        bridge = true
        break
      case 5: // sexta
        offEnd = addDays(h.date, 2)
        break
      case 6: // sábado
        offEnd = addDays(h.date, 1)
        break
      case 0: // domingo
        offStart = addDays(h.date, -1)
        break
      // quarta: só o dia
    }
  }
  const checkin = addDays(offStart, -1)
  const checkout = offEnd
  const nights = Math.round((toUTC(checkout).getTime() - toUTC(checkin).getTime()) / 86_400_000)
  return { ...h, offStart, offEnd, checkin, checkout, nights, bridge }
}

/**
 * Próximos feriadões cujo check-in sugerido ainda não passou, em ordem. Ignora os que não dão viagem: só o feriado numa quarta.
 */
export function upcomingLongWeekends(today: string, limit = 8): LongWeekend[] {
  const year = Number(today.slice(0, 4))
  return [...holidaysOf(year), ...holidaysOf(year + 1)]
    .map(longWeekend)
    .filter((w) => w.checkin >= today && w.nights >= 2)
    .slice(0, limit)
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "21 de abril (terça)". */
export function formatHolidayDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} de ${MONTHS[m! - 1]} (${WEEKDAYS[weekday(date)]})`
}

/** "sábado, 18 a terça, 21 de abril". */
export function formatRange(start: string, end: string): string {
  const [, ms, ds] = start.split('-').map(Number)
  const [, me, de] = end.split('-').map(Number)
  const left =
    ms === me
      ? `${WEEKDAYS[weekday(start)]}, ${ds}`
      : `${WEEKDAYS[weekday(start)]}, ${ds} de ${MONTHS[ms! - 1]}`
  return `${left} a ${WEEKDAYS[weekday(end)]}, ${de} de ${MONTHS[me! - 1]}`
}

/** Busca de pousadas já com as datas do feriadão (e a cidade, se houver). */
export function searchHref(w: LongWeekend, city?: string): string {
  const params = new URLSearchParams({ checkin: w.checkin, checkout: w.checkout })
  if (city) params.set('busca', city)
  return `/pousadas?${params}`
}
