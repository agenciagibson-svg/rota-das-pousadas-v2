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
