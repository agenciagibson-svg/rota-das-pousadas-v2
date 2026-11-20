import { describe, expect, it } from 'vitest'
import {
  AUTO_CLOSE_HOURS,
  inStay,
  phaseCard,
  phaseEntryPath,
  POS_DAYS,
  resolveAppState,
  stayClosed,
  type PhaseBooking,
} from './phase'

/** Relógio de Brasília (UTC-3): `at('2026-12-10', '09:00')`. */
const at = (date: string, time = '12:00') => new Date(`${date}T${time}:00-03:00`)

let seq = 0
function booking(over: Partial<PhaseBooking> = {}): PhaseBooking {
  seq += 1
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    code: `RP-${seq}`,
    status: 'confirmed',
    checkin: '2026-12-10',
    checkout: '2026-12-13',
    pousadaName: `Pousada ${seq}`,
    pousadaSlug: `pousada-${seq}`,
    checkoutTime: '11:00',
    timezone: 'America/Sao_Paulo',
    paymentDueAt: null,
    ...over,
  }
}

describe('fase do app', () => {
  it('sem reservas: loja', () => {
    expect(resolveAppState([], at('2026-12-01')).phase).toEqual({ kind: 'loja' })
  })

  it('pagamento aprovado antes do check-in: viagem marcada, com dias que faltam', () => {
    const b = booking()
    const { phase } = resolveAppState([b], at('2026-12-07'))
    expect(phase).toEqual({ kind: 'viagem', booking: b, daysLeft: 3 })
    expect(phaseEntryPath(phase)).toBe(`/estadia/${b.id}`)
  })

  it('vira estadia à meia-noite do dia do check-in, no horário da pousada', () => {
    const b = booking()
    expect(resolveAppState([b], at('2026-12-09', '23:59')).phase.kind).toBe('viagem')
    expect(resolveAppState([b], at('2026-12-10', '00:00')).phase).toEqual({
      kind: 'estadia',
      booking: b,
    })
  })

  it('check-in feito antes da data pela pousada já abre a estadia', () => {
    const b = booking({ status: 'checked_in' })
    expect(resolveAppState([b], at('2026-12-09', '20:00')).phase.kind).toBe('estadia')
  })

  it('fuso da pousada manda: Cuiabá (UTC-4) ainda é véspera às 00:30 de Brasília', () => {
    const b = booking({ timezone: 'America/Cuiaba' })
    expect(resolveAppState([b], at('2026-12-10', '00:30')).phase.kind).toBe('viagem')
    expect(resolveAppState([b], at('2026-12-10', '01:00')).phase.kind).toBe('estadia')
  })

  it('pousada fecha a estadia: pós-estadia na hora, mesmo antes da data de saída', () => {
    const b = booking({ status: 'checked_out' })
    const { phase } = resolveAppState([b], at('2026-12-12'))
    expect(phase).toEqual({ kind: 'pos', booking: b })
    expect(phaseEntryPath(phase)).toBe('/')
  })

  it(`pousada esquece de fechar: fecha ${AUTO_CLOSE_HOURS}h depois do horário de check-out`, () => {
    const b = booking({ status: 'checked_in', checkoutTime: '11:00' })
    expect(stayClosed(b, at('2026-12-13', '14:59'))).toBe(false)
    expect(resolveAppState([b], at('2026-12-13', '14:59')).phase.kind).toBe('estadia')
    expect(stayClosed(b, at('2026-12-13', '15:00'))).toBe(true)
    expect(resolveAppState([b], at('2026-12-13', '15:00')).phase.kind).toBe('pos')
  })

  it('horário de check-out vazio ou inválido usa 12:00', () => {
    for (const checkoutTime of ['', 'xx', '25:00']) {
      const b = booking({ status: 'checked_in', checkoutTime })
      expect(inStay(b, at('2026-12-13', '15:59'))).toBe(true)
      expect(inStay(b, at('2026-12-13', '16:00'))).toBe(false)
    }
  })

  it('aceita horário com segundos ("11:00:00")', () => {
    const b = booking({ status: 'checked_in', checkoutTime: '11:00:00' })
    expect(stayClosed(b, at('2026-12-13', '15:00'))).toBe(true)
  })

  it(`pós-estadia dura ${POS_DAYS} dias depois do check-out; depois, loja`, () => {
    const b = booking({ status: 'checked_out' })
    expect(resolveAppState([b], at('2026-12-20')).phase.kind).toBe('pos')
    expect(resolveAppState([b], at('2026-12-21')).phase).toEqual({ kind: 'loja' })
  })

  it('pagamento pendente não muda a fase; vira aviso enquanto está no prazo', () => {
    const p = booking({ status: 'pending', paymentDueAt: '2026-12-01T18:00:00-03:00' })
    const s = resolveAppState([p], at('2026-12-01', '10:00'))
    expect(s.phase).toEqual({ kind: 'loja' })
    expect(s.pending).toEqual([p])
    expect(resolveAppState([p], at('2026-12-01', '18:01')).pending).toEqual([])
  })

  it('pagamento pendente no dia do check-in não abre a estadia', () => {
    const p = booking({ status: 'pending' })
    expect(resolveAppState([p], at('2026-12-10')).phase.kind).toBe('loja')
  })

  it('cancelada e não compareceu voltam para a loja, sem pós-estadia', () => {
    for (const status of ['cancelled', 'no_show']) {
      const b = booking({ status })
      expect(resolveAppState([b], at('2026-12-11')).phase).toEqual({ kind: 'loja' })
      expect(resolveAppState([b], at('2026-12-14')).phase).toEqual({ kind: 'loja' })
    }
  })

  it('estadia atual manda; a reserva futura vira "próxima viagem"', () => {
    const now = booking({ status: 'checked_in' })
    const next = booking({ checkin: '2027-01-05', checkout: '2027-01-08' })
    const s = resolveAppState([next, now], at('2026-12-11'))
    expect(s.phase).toEqual({ kind: 'estadia', booking: now })
    expect(s.upcoming).toEqual([next])
  })

  it('duas estadias em curso no mesmo dia: o app pergunta qual abrir', () => {
    const a = booking({ checkin: '2026-12-10', checkout: '2026-12-12' })
    const b = booking({ checkin: '2026-12-12', checkout: '2026-12-14' })
    const { phase } = resolveAppState([b, a], at('2026-12-12', '09:00'))
    expect(phase).toEqual({ kind: 'escolher', bookings: [a, b] })
    expect(phaseEntryPath(phase)).toBe('/estadia')
    // Às 15h a primeira fecha (check-out 11h + 4h) e sobra uma.
    expect(resolveAppState([b, a], at('2026-12-12', '15:00')).phase).toEqual({
      kind: 'estadia',
      booking: b,
    })
  })

  it('viagem marcada vence o pós-estadia; a mais próxima define a fase', () => {
    const done = booking({ status: 'checked_out', checkin: '2026-12-01', checkout: '2026-12-03' })
    const far = booking({ checkin: '2027-02-01', checkout: '2027-02-03' })
    const near = booking({ checkin: '2026-12-20', checkout: '2026-12-22' })
    const s = resolveAppState([done, far, near], at('2026-12-05'))
    expect(s.phase).toMatchObject({ kind: 'viagem', booking: near, daysLeft: 15 })
    expect(s.upcoming).toEqual([far])
  })

  it('pós-estadia lembra da estadia que terminou por último', () => {
    const older = booking({ status: 'checked_out', checkin: '2026-12-01', checkout: '2026-12-03' })
    const newer = booking({ status: 'checked_out', checkin: '2026-12-03', checkout: '2026-12-05' })
    expect(resolveAppState([older, newer], at('2026-12-06')).phase).toEqual({
      kind: 'pos',
      booking: newer,
    })
  })

  it('confirmada que passou da data sem check-in também encerra', () => {
    const b = booking()
    expect(resolveAppState([b], at('2026-12-14')).phase).toEqual({ kind: 'pos', booking: b })
  })

  it('a loja é a porta de entrada da fase de loja', () => {
    expect(phaseEntryPath({ kind: 'loja' })).toBe('/')
  })
})

describe('cartão da fase na loja', () => {
  it('estadia e viagem levam para o app da pousada', () => {
    const b = booking({ pousadaName: 'Pousada Ipê' })
    expect(phaseCard(resolveAppState([b], at('2026-12-11')))).toMatchObject({
      kind: 'estadia',
      title: 'Pousada Ipê',
      href: `/estadia/${b.id}`,
    })
    expect(phaseCard(resolveAppState([b], at('2026-12-09')))).toMatchObject({
      kind: 'viagem',
      eyebrow: 'Sua viagem é amanhã',
    })
    expect(phaseCard(resolveAppState([b], at('2026-12-01')))?.eyebrow).toBe(
      'Sua viagem · faltam 9 dias',
    )
  })

  it('pós-estadia pede avaliação e pode ser dispensado', () => {
    const b = booking({ status: 'checked_out' })
    expect(phaseCard(resolveAppState([b], at('2026-12-14')))).toMatchObject({
      kind: 'pos',
      href: `/minhas-reservas/${b.id}/avaliar`,
      dismissKey: `rp_pos_${b.id}`,
    })
  })

  it('na loja, só aparece com pagamento pendente', () => {
    expect(phaseCard(resolveAppState([], at('2026-12-01')))).toBeNull()
    const p = booking({ status: 'pending', pousadaSlug: 'ipe' })
    expect(phaseCard(resolveAppState([p], at('2026-12-01')))).toMatchObject({
      kind: 'pendente',
      href: `/pousada/ipe/reservar/${p.id}/pagamento`,
    })
  })
})
