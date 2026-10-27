import { describe, expect, it } from 'vitest'
import {
  barPlacement,
  busyNightsByRoom,
  cellsFromPixels,
  draggedTarget,
  findMoveConflict,
  moveCapabilities,
  newBookingHref,
  parseNewBookingPrefill,
  priceEffect,
  resolveWindow,
  validateMoveTarget,
  weekdayShort,
  windowNights,
  type OccupancyBoard,
  type OccupancyBooking,
} from './occupancy'

function booking(over: Partial<OccupancyBooking> = {}): OccupancyBooking {
  return {
    id: 'b1',
    code: 'RP-AAA111',
    roomId: 'r1',
    guestName: 'Ana Teste',
    checkin: '2026-11-10',
    checkout: '2026-11-12',
    status: 'confirmed',
    origin: 'balcao',
    guests: 2,
    pets: false,
    subtotal: 600,
    total: 550,
    amountReceived: 0,
    version: 1,
    ...over,
  }
}

const board: Pick<OccupancyBoard, 'rooms' | 'bookings' | 'holds'> = {
  rooms: [
    { id: 'r1', name: 'Chalé 1', capacity: 2, petsAllowed: false, unavailable: false },
    { id: 'r2', name: 'Chalé 2', capacity: 2, petsAllowed: true, unavailable: false },
    { id: 'r3', name: 'Suíte', capacity: 4, petsAllowed: false, unavailable: false },
    { id: 'r4', name: 'Chalé 3', capacity: 2, petsAllowed: false, unavailable: true },
  ],
  bookings: [
    booking(),
    booking({ id: 'b2', code: 'RP-BBB222', guestName: 'Bruno', roomId: 'r2' }),
    booking({
      id: 'b3',
      roomId: 'r3',
      status: 'cancelled',
      checkin: '2026-11-20',
      checkout: '2026-11-22',
    }),
  ],
  holds: [
    {
      id: 'h1',
      roomId: 'r2',
      startsOn: '2026-11-15',
      endsOn: '2026-11-17',
      kind: 'block',
      label: 'Pintura',
    },
    {
      id: 'h2',
      roomId: 'r1',
      startsOn: '2026-11-25',
      endsOn: '2026-11-26',
      kind: 'channel',
      label: 'Booking.com',
    },
    {
      id: 'h3',
      roomId: 'r1',
      startsOn: '2026-11-10',
      endsOn: '2026-11-13',
      kind: 'channel',
      label: 'Airbnb',
    },
  ],
}

describe('janela', () => {
  it('lista as noites a partir do início', () => {
    expect(windowNights('2026-12-30', 4)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  it('padrão: começa ontem, 14 dias; aceita 30 e início válido', () => {
    expect(resolveWindow('2026-10-26', {})).toEqual({ from: '2026-10-25', days: 14 })
    expect(resolveWindow('2026-10-26', { inicio: '2026-11-01', dias: '30' })).toEqual({
      from: '2026-11-01',
      days: 30,
    })
  })

  it('ignora início inválido ou distante demais', () => {
    expect(resolveWindow('2026-10-26', { inicio: '2026-13-45' }).from).toBe('2026-10-25')
    expect(resolveWindow('2026-10-26', { inicio: 'ontem' }).from).toBe('2026-10-25')
    expect(resolveWindow('2026-10-26', { inicio: '2040-01-01' }).from).toBe('2026-10-25')
    expect(resolveWindow('2026-10-26', { dias: '365' }).days).toBe(14)
  })

  it('dia da semana sem fuso', () => {
    expect(weekdayShort('2026-10-26')).toBe('seg')
    expect(weekdayShort('2026-11-01')).toBe('dom')
  })
})

describe('posição das barras', () => {
  it('coluna = noite; a saída não ocupa coluna', () => {
    expect(barPlacement('2026-11-10', '2026-11-12', '2026-11-08', 14)).toEqual({
      start: 2,
      span: 2,
      cutStart: false,
      cutEnd: false,
    })
  })

  it('corta no começo e no fim da janela', () => {
    expect(barPlacement('2026-11-05', '2026-11-10', '2026-11-08', 14)).toEqual({
      start: 0,
      span: 2,
      cutStart: true,
      cutEnd: false,
    })
    expect(barPlacement('2026-11-20', '2026-11-30', '2026-11-08', 14)).toEqual({
      start: 12,
      span: 2,
      cutStart: false,
      cutEnd: true,
    })
  })

  it('fora da janela não aparece (saída no primeiro dia também não)', () => {
    expect(barPlacement('2026-11-01', '2026-11-08', '2026-11-08', 14)).toBeNull()
    expect(barPlacement('2026-11-22', '2026-11-24', '2026-11-08', 14)).toBeNull()
  })

  it('pixels viram células arredondadas, sem -0', () => {
    expect(cellsFromPixels(70, 48)).toBe(1)
    expect(cellsFromPixels(-100, 48)).toBe(-2)
    expect(Object.is(cellsFromPixels(-10, 48), 0)).toBe(true)
    expect(cellsFromPixels(10, 0)).toBe(0)
  })

  it('noites ocupadas por quarto ignoram reserva cancelada', () => {
    const busy = busyNightsByRoom(board)
    expect([...busy.get('r1')!].sort()).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-25',
    ])
    expect(busy.get('r3')).toBeUndefined()
  })
})

describe('o que pode mudar', () => {
  it('confirmada e pendente movem e redimensionam', () => {
    expect(moveCapabilities(booking())).toEqual({ canMove: true, canResize: true })
    expect(moveCapabilities(booking({ status: 'pending' })).canMove).toBe(true)
  })

  it('em estadia só muda a saída', () => {
    expect(moveCapabilities(booking({ status: 'checked_in' }))).toMatchObject({
      canMove: false,
      canResize: true,
    })
  })

  it('reserva de canal e concluída não mudam', () => {
    expect(moveCapabilities(booking({ origin: 'airbnb' }))).toMatchObject({
      canMove: false,
      canResize: false,
      reason: expect.stringContaining('Airbnb'),
    })
    expect(moveCapabilities(booking({ origin: 'booking_com' })).reason).toContain('Booking.com')
    expect(moveCapabilities(booking({ status: 'checked_out' })).canResize).toBe(false)
  })
})

describe('arrastar', () => {
  it('mover mantém a duração', () => {
    expect(draggedTarget(booking(), 'move', 3, 'r3')).toEqual({
      roomId: 'r3',
      checkin: '2026-11-13',
      checkout: '2026-11-15',
    })
  })

  it('puxar a borda muda só a saída, no mínimo 1 noite', () => {
    expect(draggedTarget(booking(), 'resize', 2, 'r3')).toEqual({
      roomId: 'r1',
      checkin: '2026-11-10',
      checkout: '2026-11-14',
    })
    expect(draggedTarget(booking(), 'resize', -5, 'r1').checkout).toBe('2026-11-11')
  })
})

describe('regras de data e status (espelho da 0096)', () => {
  const today = '2026-11-11'

  it('entrada nova no passado é recusada; manter a entrada passada não', () => {
    const late = booking({ checkin: '2026-11-10', checkout: '2026-11-13' })
    expect(
      validateMoveTarget(
        late,
        { roomId: 'r1', checkin: '2026-11-09', checkout: '2026-11-12' },
        today,
      ),
    ).toBe('A nova entrada não pode ser no passado.')
    expect(
      validateMoveTarget(
        late,
        { roomId: 'r2', checkin: '2026-11-10', checkout: '2026-11-13' },
        today,
      ),
    ).toBeNull()
  })

  it('em estadia: nem quarto nem entrada; saída não antes de hoje', () => {
    const stay = booking({ status: 'checked_in', checkin: '2026-11-09', checkout: '2026-11-12' })
    expect(
      validateMoveTarget(
        stay,
        { roomId: 'r2', checkin: '2026-11-09', checkout: '2026-11-12' },
        today,
      ),
    ).toContain('só dá para mudar a data de saída')
    expect(
      validateMoveTarget(
        stay,
        { roomId: 'r1', checkin: '2026-11-09', checkout: '2026-11-10' },
        today,
      ),
    ).toBe('A nova saída não pode ser antes de hoje.')
    expect(
      validateMoveTarget(
        stay,
        { roomId: 'r1', checkin: '2026-11-09', checkout: '2026-11-15' },
        today,
      ),
    ).toBeNull()
  })

  it('nada mudou, zero noites e canal', () => {
    const b = booking({ checkin: '2026-11-20', checkout: '2026-11-22' })
    expect(
      validateMoveTarget(b, { roomId: 'r1', checkin: '2026-11-20', checkout: '2026-11-22' }, today),
    ).toBe('A reserva já está nesse quarto e nessas datas.')
    expect(
      validateMoveTarget(b, { roomId: 'r1', checkin: '2026-11-20', checkout: '2026-11-20' }, today),
    ).toBe('A data de saída deve ser posterior à de entrada.')
    expect(
      validateMoveTarget(
        booking({ origin: 'airbnb' }),
        { roomId: 'r2', checkin: '2026-11-20', checkout: '2026-11-22' },
        today,
      ),
    ).toContain('Airbnb')
  })
})

describe('conflito no cliente', () => {
  it('outra reserva no destino', () => {
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r2',
        checkin: '2026-11-11',
        checkout: '2026-11-13',
      }),
    ).toEqual({
      kind: 'booking',
      bookingId: 'b2',
      message: 'Conflita com a reserva de Bruno (RP-BBB222).',
    })
  })

  it('saída no dia da entrada da outra não conflita; a própria reserva não conta', () => {
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r2',
        checkin: '2026-11-12',
        checkout: '2026-11-14',
      }),
    ).toBeNull()
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r1',
        checkin: '2026-11-11',
        checkout: '2026-11-13',
      })?.kind,
    ).not.toBe('booking')
  })

  it('reserva cancelada não ocupa', () => {
    expect(
      findMoveConflict(board, booking({ guests: 3 }), {
        roomId: 'r3',
        checkin: '2026-11-20',
        checkout: '2026-11-22',
      }),
    ).toBeNull()
  })

  it('bloqueio e noite vendida no canal', () => {
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r2',
        checkin: '2026-11-16',
        checkout: '2026-11-18',
      }),
    ).toMatchObject({
      kind: 'block',
    })
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r1',
        checkin: '2026-11-24',
        checkout: '2026-11-26',
      }),
    ).toMatchObject({
      kind: 'channel',
      message: expect.stringContaining('Booking.com'),
    })
  })

  it('eco do iCal nas noites que a reserva já ocupava não conta; noite nova conta', () => {
    // h3 cobre 10–13 no Chalé 1; a reserva ocupava 10–12.
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r1',
        checkin: '2026-11-10',
        checkout: '2026-11-11',
      }),
    ).toBeNull()
    expect(
      findMoveConflict(board, booking(), {
        roomId: 'r1',
        checkin: '2026-11-10',
        checkout: '2026-11-13',
      })?.kind,
    ).toBe('channel')
  })

  it('capacidade, pets e manutenção', () => {
    const t = { checkin: '2026-12-01', checkout: '2026-12-02' }
    expect(findMoveConflict(board, booking({ guests: 3 }), { roomId: 'r2', ...t })?.message).toBe(
      'Chalé 2 comporta até 2 hóspedes.',
    )
    expect(findMoveConflict(board, booking({ pets: true }), { roomId: 'r3', ...t })?.message).toBe(
      'Suíte não aceita pets.',
    )
    expect(findMoveConflict(board, booking(), { roomId: 'r4', ...t })?.message).toContain(
      'manutenção',
    )
    expect(findMoveConflict(board, booking(), { roomId: 'zz', ...t })?.kind).toBe('room')
  })
})

describe('efeito no valor', () => {
  it('mantém o combinado e mostra o recalculado trocando só as diárias', () => {
    // 600 de diárias − 50 de desconto = 550; tarifas novas: 1200 → 1150.
    expect(priceEffect({ subtotal: 600, total: 550, amountReceived: 0 }, 1200)).toEqual({
      currentTotal: 550,
      repricedTotal: 1150,
      difference: 600,
      paid: false,
      repricedBelowPaid: false,
    })
  })

  it('sem cotação: só o combinado', () => {
    expect(priceEffect({ subtotal: 600, total: 550, amountReceived: 0 }, null)).toMatchObject({
      repricedTotal: null,
      difference: null,
    })
  })

  it('paga: marca e avisa quando o novo fica abaixo do pago', () => {
    const e = priceEffect({ subtotal: 600, total: 600, amountReceived: 600 }, 300)
    expect(e).toMatchObject({ paid: true, repricedTotal: 300, repricedBelowPaid: true })
  })
})

describe('nova reserva a partir do mapa', () => {
  it('link leva quarto, entrada e saída', () => {
    expect(newBookingHref('r1', '2026-12-31')).toBe(
      '/dashboard/reservas/nova?quarto=r1&entrada=2026-12-31&saida=2027-01-01',
    )
  })

  it('formulário aceita só quarto da pousada e datas válidas', () => {
    expect(
      parseNewBookingPrefill({ quarto: 'r1', entrada: '2026-12-31', saida: '2027-01-02' }, [
        'r1',
        'r2',
      ]),
    ).toEqual({ roomId: 'r1', checkin: '2026-12-31', checkout: '2027-01-02' })
    expect(
      parseNewBookingPrefill({ quarto: 'alheio', entrada: '2026-12-31', saida: 'x' }, ['r1']),
    ).toEqual({
      roomId: undefined,
      checkin: '2026-12-31',
      checkout: '2027-01-01',
    })
    expect(
      parseNewBookingPrefill({ entrada: '2026-12-31', saida: '2026-12-30' }, []).checkout,
    ).toBe('2027-01-01')
    expect(parseNewBookingPrefill({ entrada: '31/12/2026' }, [])).toEqual({
      roomId: undefined,
      checkin: undefined,
      checkout: undefined,
    })
  })
})
