import type { RoomBlock } from './types'

const BLOCK_DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

/**
 * Os bloqueios guardam a hora civil da pousada como UTC (`civilDateTimeToISO`).
 * Formatar no fuso do navegador somava o fuso de novo: quem digitava 14:00 via
 * 11:00 na lista.
 */
export function formatBlockDateTime(iso: string): string {
  return BLOCK_DATE_TIME.format(new Date(iso))
}

export type BlockTimeStatus = { label: string; variant: 'primarySoft' | 'secondary' | 'goldSoft' }

/** Situação do bloqueio pelo relógio da pousada no mesmo referencial (`civilNow`). */
export function blockTimeStatus(
  block: Pick<RoomBlock, 'status' | 'startsAt' | 'endsAt'>,
  nowCivilMs: number,
): BlockTimeStatus {
  if (block.status === 'cancelled') return { label: 'Cancelado', variant: 'secondary' }
  if (new Date(block.endsAt).getTime() < nowCivilMs)
    return { label: 'Expirado', variant: 'secondary' }
  if (new Date(block.startsAt).getTime() > nowCivilMs)
    return { label: 'Futuro', variant: 'goldSoft' }
  return { label: 'Vigente', variant: 'primarySoft' }
}

const DAY_MS = 86_400_000

function civilDate(ms: number): string {
  const d = new Date(ms)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

/**
 * Período legível. Bloqueio de dias inteiros (00:00 → 00:00, como os do
 * calendário) vira "30/10/2026 (dia inteiro)" ou "30/10/2026 a 02/11/2026
 * (4 dias)" — "30/10 00:00 — 31/10 00:00" confundia (parecia pegar dois dias).
 */
export function formatBlockPeriod(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—'
  const wholeDays = start % DAY_MS === 0 && end % DAY_MS === 0 && end > start
  if (wholeDays) {
    const days = Math.round((end - start) / DAY_MS)
    if (days === 1) return `${civilDate(start)} (dia inteiro)`
    return `${civilDate(start)} a ${civilDate(end - DAY_MS)} (${days} dias)`
  }
  return `${formatBlockDateTime(startsAt)} — ${formatBlockDateTime(endsAt)}`
}
