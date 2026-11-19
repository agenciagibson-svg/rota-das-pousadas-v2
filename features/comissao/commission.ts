/**
 * Regras puras do extrato de comissão (0104), sem I/O. O valor de cada
 * comissão vem pronto do banco; aqui ficam o mês da tela e os totais.
 */
import type { CommissionMonth } from './types'

/** `2026-12` (query string) → `2026-12-01`; qualquer outra coisa → `null`. */
export function parseMonthParam(value: string | string[] | undefined | null): string | null {
  if (typeof value !== 'string') return null
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null
}

/** `2026-12-01` → `2026-12`, para montar o link do mês. */
export function monthParam(month: string): string {
  return month.slice(0, 7)
}

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

/** `2026-12-01` → "dezembro de 2026". */
export function monthLabel(month: string): string {
  const date = new Date(`${month.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? month : MONTH_LABEL.format(date)
}

/** "6%" a partir de 0.06 (sem casas quando é inteiro, vírgula quando não é). */
export function rateLabel(rate: number): string {
  const percent = Math.round(rate * 10000) / 100
  return `${String(percent).replace('.', ',')}%`
}

export type CommissionTotals = { bookings: number; base: number; due: number; waived: number }

const cents = (value: number) => Math.round(value * 100)

/** Soma em centavos, para 0,1 + 0,2 não virar 0,30000000000000004. */
export function sumCommissionMonths(months: readonly CommissionMonth[]): CommissionTotals {
  const total = months.reduce(
    (acc, m) => ({
      bookings: acc.bookings + m.bookings,
      base: acc.base + cents(m.base),
      due: acc.due + cents(m.due),
      waived: acc.waived + cents(m.waived),
    }),
    { bookings: 0, base: 0, due: 0, waived: 0 },
  )
  return {
    bookings: total.bookings,
    base: total.base / 100,
    due: total.due / 100,
    waived: total.waived / 100,
  }
}

/** O mês aberto dentro da lista; `null` quando o mês não tem comissão. */
export function findMonth<T extends CommissionMonth>(
  months: readonly T[],
  month: string,
): T | null {
  return months.find((m) => m.month.slice(0, 7) === month.slice(0, 7)) ?? null
}
