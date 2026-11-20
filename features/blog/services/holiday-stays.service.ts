import 'server-only'
import { isoDateInTimeZone } from '@/lib/dates'
import { normalizeCatalogText } from '@/features/pousadas/search'
import { addDays, upcomingLongWeekends, type LongWeekend } from '@/features/feriados/feriados'
import { listPousadas } from '@/services/pousadas.service'
import type { Pousada } from '@/types'

export type HolidayStays = { weekend: LongWeekend; stays: Pousada[] }

/**
 * Pousadas da cidade do guia com vaga no próximo feriadão (2 adultos), pela
 * mesma busca do site (`search_public_pousadas`, que confere a
 * disponibilidade real das acomodações).
 *
 * Pula o feriadão que começa em menos de 2 dias: quem lê o guia hoje não
 * chega a tempo. Falha na busca não derruba o guia: devolve o feriadão sem
 * pousadas e a página mostra o atalho para a busca com as datas.
 */
export async function holidayStays(
  city: string,
  today = isoDateInTimeZone(new Date()),
): Promise<HolidayStays | null> {
  const weekend = upcomingLongWeekends(addDays(today, 2), 1)[0]
  if (!weekend) return null
  try {
    const result = await listPousadas({
      search: city,
      checkin: weekend.checkin,
      checkout: weekend.checkout,
      guests: 2,
      pageSize: 12,
    })
    const wanted = normalizeCatalogText(city)
    const stays = result.items.filter((p) => normalizeCatalogText(p.city) === wanted).slice(0, 4)
    return { weekend, stays }
  } catch {
    return { weekend, stays: [] }
  }
}
