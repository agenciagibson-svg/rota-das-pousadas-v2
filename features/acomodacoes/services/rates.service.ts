import 'server-only'
import { requireCapability, requireAnyCapability } from '@/lib/auth/require-capability'
import {
  deleteRateRule,
  insertRateRule,
  listRateRulesByPousada,
  updateRateRule,
  quoteRoomStay,
  type CounterStayQuote,
  type RateRuleWrite,
} from '@/repositories/rate-rules.repository'
import type { RateRule } from '../types'
import type { RateRuleInput } from '../schemas'

/**
 * Tarifas por temporada (0087). Ler: quem gerencia acomodações ou lança
 * reserva no balcão (a recepção precisa saber o preço da data). Escrever: só
 * quem gerencia acomodações (`room:manage`), como a diária-base.
 * A auditoria é gravada por gatilho no banco.
 */
export async function listRateRules(): Promise<RateRule[]> {
  const { pousadaId } = await requireAnyCapability(['room:manage', 'booking:manage'])
  return listRateRulesByPousada(pousadaId)
}

function toWrite(pousadaId: string, input: RateRuleInput): RateRuleWrite {
  const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b)
  return {
    pousadaId,
    name: input.name,
    roomId: input.roomId || null,
    firstNight: input.firstNight,
    lastNight: input.lastNight,
    // Todos os dias marcados = sem filtro de dia da semana.
    weekdays: weekdays.length === 0 || weekdays.length === 7 ? null : weekdays,
    kind: input.kind,
    value: input.kind === 'fixed' ? Math.round(input.value) : input.value,
    minNights: input.minNights ?? null,
    active: input.active,
  }
}

export async function addRateRule(input: RateRuleInput): Promise<{ id: string }> {
  const { pousadaId } = await requireCapability('room:manage')
  return insertRateRule(toWrite(pousadaId, input))
}

export async function editRateRule(id: string, input: RateRuleInput): Promise<void> {
  const { pousadaId } = await requireCapability('room:manage')
  const updated = await updateRateRule(id, toWrite(pousadaId, input))
  if (!updated) throw new Error('Regra não encontrada nesta pousada.')
}

export async function removeRateRule(id: string): Promise<void> {
  const { pousadaId } = await requireCapability('room:manage')
  const removed = await deleteRateRule(id, pousadaId)
  if (!removed) throw new Error('Regra não encontrada nesta pousada.')
}

/**
 * Preço da estadia no balcão (nova reserva pelo painel): mesma conta da reserva
 * pelo site, com as tarifas de temporada. A equipe ainda pode ajustar o valor.
 */
export async function quoteStayForCounter(input: {
  roomId: string
  checkin: string
  checkout: string
}): Promise<CounterStayQuote | null> {
  await requireAnyCapability(['booking:manage', 'room:manage'])
  return quoteRoomStay(input.roomId, input.checkin, input.checkout)
}
