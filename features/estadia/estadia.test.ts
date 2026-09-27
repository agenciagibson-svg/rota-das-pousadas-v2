import { describe, expect, it } from 'vitest'
import { parseGuestStay } from './types'
import { toSummary } from '@/features/pedidos/types'

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
      info: { wifiName: 'Refugio', wifiPassword: '', guestInfo: '', ordersHours: '' },
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
  })
})
