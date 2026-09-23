import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { blockTimeStatus, formatBlockDateTime } from './block-time'
import { civilDateTimeToISO, civilNow } from '@/lib/dates'

// O navegador da recepção está em Brasília; o servidor da Vercel, em UTC.
const originalTZ = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/Sao_Paulo'
})
afterAll(() => {
  process.env.TZ = originalTZ
})

describe('horário dos bloqueios', () => {
  it('grava o horário digitado como hora civil, em qualquer fuso de servidor', () => {
    expect(civilDateTimeToISO('2026-09-23T14:00')).toBe('2026-09-23T14:00:00.000Z')
    expect(civilDateTimeToISO('2026-09-23T14:00:30')).toBe('2026-09-23T14:00:30.000Z')
  })

  it('mostra o horário como foi digitado, não 3h antes', () => {
    // O PostgREST devolve o instante gravado assim.
    expect(formatBlockDateTime('2026-09-23T14:00:00+00:00')).toBe('23/09/2026, 14:00')
  })

  it('decide Futuro/Vigente/Expirado pelo relógio da pousada', () => {
    const block = {
      status: 'active' as const,
      startsAt: '2026-09-23T14:00:00+00:00',
      endsAt: '2026-09-23T18:00:00+00:00',
    }
    // 12:00 em Brasília = 15:00 UTC: o bloqueio das 14h ainda não começou.
    const noon = civilNow(new Date('2026-09-23T15:00:00Z'), 'America/Sao_Paulo')
    expect(noon.toISOString()).toBe('2026-09-23T12:00:00.000Z')
    expect(blockTimeStatus(block, noon.getTime()).label).toBe('Futuro')
    // 16:00 em Brasília: vigente.
    expect(
      blockTimeStatus(
        block,
        civilNow(new Date('2026-09-23T19:00:00Z'), 'America/Sao_Paulo').getTime(),
      ).label,
    ).toBe('Vigente')
    // 19:00 em Brasília: expirado.
    expect(
      blockTimeStatus(
        block,
        civilNow(new Date('2026-09-23T22:00:00Z'), 'America/Sao_Paulo').getTime(),
      ).label,
    ).toBe('Expirado')
    expect(blockTimeStatus({ ...block, status: 'cancelled' }, noon.getTime()).label).toBe(
      'Cancelado',
    )
  })
})
