import 'server-only'
import { isoDateInTimeZone } from '@/lib/dates'
import { getPublicPriceCalendarRpc } from '@/repositories/price-calendar.repository'
import { clampMonth, monthRange, type PriceCalendarDay } from '../price-calendar'

/**
 * Noites de um mês do calendário com preço (0094). Mês fora da janela
 * navegável (passado ou longe demais) volta vazio sem chamar o banco.
 * Preço, vaga e mínimo são os do servidor — a mesma cotação da reserva.
 */
export async function getPublicPriceCalendar(p: {
  slug: string
  month: string
  guests: number
  roomId?: string
}): Promise<PriceCalendarDay[]> {
  const today = isoDateInTimeZone(new Date())
  if (clampMonth(p.month, today) !== p.month) return []
  const { from, to } = monthRange(p.month)
  return getPublicPriceCalendarRpc({
    slug: p.slug,
    from,
    to,
    // A bio aceita até 100 hóspedes (mesmo teto da RPC); a reserva, até 20.
    guests: Math.min(100, Math.max(1, Math.floor(p.guests) || 1)),
    roomId: p.roomId,
  })
}
