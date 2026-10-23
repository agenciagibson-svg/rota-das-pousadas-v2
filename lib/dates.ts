/** Fuso padrão das pousadas — o mesmo default da coluna `pousadas.timezone` (0015). */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

function formatISODate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function formatISODateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`
}

/**
 * Data civil (YYYY-MM-DD) de `date` no fuso informado.
 *
 * `toISOString()` devolve a data em UTC, que no Brasil já é o dia seguinte a
 * partir das 21h — era o que fazia o painel mostrar as chegadas de amanhã como
 * se fossem de hoje. Fuso vazio ou inválido cai em Brasília, como no banco
 * (`pousada_local_date`, 0067).
 */
export function isoDateInTimeZone(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  try {
    return formatISODate(date, timeZone || DEFAULT_TIMEZONE)
  } catch {
    return formatISODate(date, DEFAULT_TIMEZONE)
  }
}

/**
 * Soma dias a uma data civil (YYYY-MM-DD) e devolve outra data civil. A conta é
 * feita em UTC de propósito: a entrada não tem hora, então não há fuso a errar.
 */
export function addDaysToISODate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** Nome de fuso IANA reconhecido (ex.: `America/Sao_Paulo`)? Texto livre como "Brasília" não é. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * Data/hora de um `<input type="datetime-local">` (sem fuso) no referencial que
 * o banco usa para bloqueios: a hora civil da pousada gravada como UTC, o mesmo
 * das datas de check-in/check-out (o dia D vale D 00:00 UTC). Com
 * `new Date(valor)` o resultado dependia do fuso de quem executa.
 */
export function civilDateTimeToISO(value: string): string {
  return new Date(`${value}Z`).toISOString()
}

/** Relógio da pousada nesse mesmo referencial: 22:30 em Brasília vira 22:30 UTC. */
export function civilNow(date: Date, timeZone: string = DEFAULT_TIMEZONE): Date {
  try {
    return new Date(`${formatISODateTime(date, timeZone || DEFAULT_TIMEZONE)}Z`)
  } catch {
    return new Date(`${formatISODateTime(date, DEFAULT_TIMEZONE)}Z`)
  }
}

/**
 * Máximo de noites numa reserva pelo site (busca, página da pousada e
 * `create_booking` público). Igual a `public_stay_max_nights()` no banco (0087):
 * mudar os dois juntos. Estadias maiores a pousada lança pelo painel.
 */
export const PUBLIC_STAY_MAX_NIGHTS = 90

/** Noites entre duas datas ISO (AAAA-MM-DD); negativo se a saída vier antes. */
export function isoNightsBetween(checkin: string, checkout: string): number {
  const a = Date.parse(`${checkin}T00:00:00Z`)
  const b = Date.parse(`${checkout}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86_400_000)
}
