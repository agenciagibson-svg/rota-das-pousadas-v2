import { describe, expect, it } from 'vitest'
import { parseGuestStay } from './types'
import { toSummary } from '@/features/pedidos/types'
import {
  agendaState,
  formatAgenda,
  normalizeTime,
  parseAgenda,
  parseEmergency,
  parseFacilities,
  parseLocalTips,
  readList,
} from './info'
import { dayMonth, daysBetween, hourLabel, shortDate } from './dates'
import { guestSettingsSchema } from '@/features/pedidos/schemas'

describe('conta de consumo', () => {
  it('saldo nunca negativo e aceita números em texto', () => {
    expect(toSummary({ delivered: '30.00', open: 0, paid: '18.00' })).toEqual({
      delivered: 30,
      open: 0,
      paid: 18,
      balance: 12,
    })
    expect(toSummary({ delivered: 10, open: 0, paid: 15 }).balance).toBe(0)
  })
})

describe('parseGuestStay', () => {
  it('converte o JSON da RPC', () => {
    const stay = parseGuestStay({
      booking: {
        id: 'b',
        code: 'RP-1',
        status: 'checked_in',
        checkin: '2026-09-27',
        checkout: '2026-09-29',
        adults: 2,
        children: 0,
        roomName: null,
        total: '1440.00',
        balanceDue: '0',
        guestName: 'Mariana',
        roomAmenities: ['Lareira', null, 'Banheira'],
      },
      pousada: {
        id: 'p',
        name: 'Refúgio',
        slug: 'r',
        image: null,
        address: '',
        city: 'Monte Verde',
        state: 'MG',
        cep: '',
        whatsapp: '',
        phone: '',
        checkinTime: null,
        checkoutTime: '12:00',
        houseRules: '',
        cancellationPolicy: '',
      },
      info: {
        wifiName: 'Refugio',
        wifiPassword: '',
        guestInfo: '',
        ordersHours: '',
        breakfastInfo: '8h às 10h30',
        facilities: [{ name: 'Piscina', hours: '9h às 21h' }, { hours: 'sem nome' }, 'lixo'],
        dailyAgenda: [{ time: '18:00', title: 'Lareira', note: null }],
      },
      today: '2026-09-27',
      canOrder: true,
      ordersEnabled: true,
      canReview: false,
      reviewed: false,
      consumption: { delivered: '18.00', open: 0, paid: '0' },
      menu: [
        {
          id: 'i',
          name: 'Água',
          category: 'bebidas',
          unit: 'garrafa',
          price: '6.00',
          description: '',
          photoUrl: null,
          available: true,
          maxQuantity: 31,
        },
      ],
    })
    expect(stay.booking.roomName).toBe('Acomodação')
    expect(stay.pousada.checkinTime).toBe('14:00')
    expect(stay.consumption.balance).toBe(18)
    expect(stay.menu[0]!.price).toBe(6)
    expect(stay.menu[0]!.maxQuantity).toBe(20)
    expect(stay.booking.guestName).toBe('Mariana')
    expect(stay.booking.roomAmenities).toEqual(['Lareira', 'Banheira'])
    expect(stay.pousada.timezone).toBe('America/Sao_Paulo')
    expect(stay.info.facilities).toEqual([{ name: 'Piscina', hours: '9h às 21h' }])
    expect(stay.info.dailyAgenda).toEqual([{ time: '18:00', title: 'Lareira', note: '' }])
    expect(stay.info.localTips).toEqual([])
    expect(stay.info.emergency).toEqual([])
  })
})

describe('informações da hospedagem (uma por linha)', () => {
  it('normaliza horários', () => {
    expect(normalizeTime('18h')).toBe('18:00')
    expect(normalizeTime('8h30')).toBe('08:30')
    expect(normalizeTime('08:05')).toBe('08:05')
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('manhã')).toBeNull()
  })

  it('agenda: ordena por horário e aponta a linha com erro', () => {
    const ok = parseAgenda('18h | Lareira acesa | Sala\n\n08:00 | Café da manhã')
    expect(ok).toEqual({
      ok: true,
      items: [
        { time: '08:00', title: 'Café da manhã', note: '' },
        { time: '18:00', title: 'Lareira acesa', note: 'Sala' },
      ],
    })
    const bad = parseAgenda('08:00 | Café\nlareira | 18h')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('linha 2')
    expect(formatAgenda(ok.ok ? ok.items : [])).toBe(
      '08:00 | Café da manhã\n18:00 | Lareira acesa | Sala',
    )
  })

  it('listas: validações e limites', () => {
    expect(parseFacilities('Piscina | 9h às 21h\nOfurô')).toEqual({
      ok: true,
      items: [
        { name: 'Piscina', hours: '9h às 21h' },
        { name: 'Ofurô', hours: '' },
      ],
    })
    expect(parseFacilities(Array.from({ length: 16 }, (_, i) => `Item ${i}`).join('\n')).ok).toBe(
      false,
    )
    expect(parseLocalTips('Pico do Selado | Trilha | 12 km')).toEqual({
      ok: true,
      items: [{ name: 'Pico do Selado', kind: 'Trilha', distance: '12 km' }],
    })
    expect(parseEmergency('SAMU | 192').ok).toBe(true)
    expect(parseEmergency('SAMU | abc').ok).toBe(false)
    expect(readList(null, ['label'])).toEqual([])
  })

  it('schema do formulário transforma texto em listas', () => {
    const r = guestSettingsSchema.safeParse({
      wifiName: '',
      wifiPassword: '',
      guestInfo: '',
      ordersEnabled: true,
      ordersHours: '',
      facilities: 'Piscina | 9h',
      dailyAgenda: 'x | sem hora',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(['dailyAgenda'])
    const ok = guestSettingsSchema.parse({
      wifiName: '',
      wifiPassword: '',
      guestInfo: '',
      ordersEnabled: true,
      ordersHours: '',
      facilities: 'Piscina | 9h',
    })
    expect(ok.facilities).toEqual([{ name: 'Piscina', hours: '9h' }])
    expect(ok.emergency).toEqual([])
    expect(ok.breakfastInfo).toBe('')
  })

  it('agenda do dia: passado, agora e depois', () => {
    const items = [
      { time: '08:00', title: 'Café', note: '' },
      { time: '15:00', title: 'Trilha', note: '' },
      { time: '18:00', title: 'Lareira', note: '' },
    ]
    expect(agendaState(items, '16:10')).toEqual(['done', 'now', 'next'])
    expect(agendaState(items, '07:00')).toEqual(['next', 'next', 'next'])
  })

  it('datas do app', () => {
    expect(shortDate('2026-09-27')).toBe('Dom, 27 set')
    expect(dayMonth('2026-09-29')).toBe('29 set')
    expect(daysBetween('2026-09-27', '2026-09-29')).toBe(2)
    expect(hourLabel('14:00')).toBe('14h')
    expect(hourLabel('10:30')).toBe('10h30')
  })
})
