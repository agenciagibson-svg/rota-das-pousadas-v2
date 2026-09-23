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
