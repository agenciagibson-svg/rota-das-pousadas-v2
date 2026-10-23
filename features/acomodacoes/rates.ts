import { formatBRL } from '@/lib/format'
import type { RateRule } from './types'

/** Rótulos curtos dos dias, na ordem de `extract(dow)` (0 = domingo). */
export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** "20/12/2026 a 05/01/2027" — noites, pontas inclusivas. */
export function describePeriod(rule: Pick<RateRule, 'firstNight' | 'lastNight'>): string {
  return rule.firstNight === rule.lastNight
    ? `Noite de ${fmtDate(rule.firstNight)}`
    : `Noites de ${fmtDate(rule.firstNight)} a ${fmtDate(rule.lastNight)}`
}

/** "Sex e Sáb" / "Todos os dias". */
export function describeWeekdays(weekdays: number[] | null): string {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return 'Todos os dias'
  const labels = [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d])
  return labels.length === 1
    ? `Só ${labels[0]}`
    : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
}

/** "Diária de R$ 650" / "+50% sobre a diária" / "−10% sobre a diária". */
export function describeAdjustment(rule: Pick<RateRule, 'kind' | 'value'>): string {
  if (rule.kind === 'fixed') return `Diária de ${formatBRL(rule.value)}`
  const sign = rule.value >= 0 ? '+' : '−'
  return `${sign}${Math.abs(rule.value).toLocaleString('pt-BR')}% sobre a diária`
}

/**
 * Diária resultante para uma diária-base — o mesmo cálculo de
 * `room_night_price` (0087), usado só para o exemplo na tela.
 */
export function previewNightly(base: number, rule: Pick<RateRule, 'kind' | 'value'>): number {
  if (rule.kind === 'fixed') return Math.max(0, Math.round(rule.value))
  return Math.max(0, Math.round(base * (1 + rule.value / 100)))
}

/** A regra já passou (última noite antes de hoje)? Fica no fim da lista, apagada. */
export function isPastRule(rule: Pick<RateRule, 'lastNight'>, todayISO: string): boolean {
  return rule.lastNight < todayISO
}
