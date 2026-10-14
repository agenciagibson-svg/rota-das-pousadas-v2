import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changeOrderStatus,
  chargeConsumption,
  getBookingConsumption,
  getOrdersScreen,
  orderPermissions,
  registerConsumptionPayment,
  reverseConsumptionPayment,
} from './orders.service'
import type { GuestOrder } from '../types'
import type { Role } from '@/lib/auth/rbac'

// A permissão é a de verdade (require-capability + rbac): só a sessão é simulada.
const mocks = vi.hoisted(() => ({
  getActivePousadaId: vi.fn(),
  getActiveTenantRole: vi.fn(),
  bookingPousadaLookup: vi.fn(),
  getConsumptionPaymentRef: vi.fn(),
  getConsumptionRpc: vi.fn(),
  getOrderPousadaId: vi.fn(),
  listBookingOrders: vi.fn(),
  listConsumptionPayments: vi.fn(),
  listPousadaOrders: vi.fn(),
  registerConsumptionPaymentRpc: vi.fn(),
  reverseConsumptionPaymentRpc: vi.fn(),
  setOrderStatusRpc: vi.fn(),
  staffCreateOrderRpc: vi.fn(),
  listReservationsByPousada: vi.fn(),
  listInventoryItems: vi.fn(),
}))

vi.mock('@/lib/auth/tenant-context', () => ({
  getActivePousadaId: mocks.getActivePousadaId,
  getActiveTenantRole: mocks.getActiveTenantRole,
}))
vi.mock('@/repositories/orders.repository', () => ({
  getConsumptionPaymentRef: mocks.getConsumptionPaymentRef,
  getConsumptionRpc: mocks.getConsumptionRpc,
  getGuestSettings: vi.fn(),
  getOrderPousadaId: mocks.getOrderPousadaId,
  listBookingOrders: mocks.listBookingOrders,
  listConsumptionPayments: mocks.listConsumptionPayments,
  listPousadaOrders: mocks.listPousadaOrders,
  registerConsumptionPaymentRpc: mocks.registerConsumptionPaymentRpc,
  reverseConsumptionPaymentRpc: mocks.reverseConsumptionPaymentRpc,
  saveGuestSettings: vi.fn(),
  setOrderStatusRpc: mocks.setOrderStatusRpc,
  staffCreateOrderRpc: mocks.staffCreateOrderRpc,
}))
vi.mock('@/repositories/management.repository', () => ({
  listReservationsByPousada: mocks.listReservationsByPousada,
}))
vi.mock('@/repositories/inventory.repository', () => ({
  listInventoryItems: mocks.listInventoryItems,
}))
// Consulta `bookings.pousada_id` feita direto pelo service (requireBookingInPousada).
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, id: string) => ({
          maybeSingle: () => mocks.bookingPousadaLookup(table, id),
        }),
      }),
    }),
  }),
}))

const ACTIVE_POUSADA = 'pousada-ativa'
const OTHER_POUSADA = 'pousada-de-outro-dono'
const BOOKING_ID = '30000000-0000-0000-0000-000000000001'
const PAYMENT_ID = '70000000-0000-0000-0000-000000000001'

function signedInAs(role: Role | null, pousadaId: string | null = ACTIVE_POUSADA) {
  mocks.getActivePousadaId.mockResolvedValue(pousadaId)
  mocks.getActiveTenantRole.mockResolvedValue(role)
}

beforeEach(() => {
  vi.resetAllMocks()
  signedInAs('proprietario')
  mocks.bookingPousadaLookup.mockResolvedValue({
    data: { pousada_id: ACTIVE_POUSADA },
    error: null,
  })
})

describe('orderPermissions — o que cada papel pode na conta de consumo', () => {
  it('recepcionista opera pedidos, lança consumo e registra pagamento, mas não estorna', () => {
    expect(orderPermissions('recepcionista')).toEqual({
      operate: true,
      charge: true,
      showPrices: true,
      registerPayment: true,
      reversePayment: false,
    })
  })

  it('financeiro da pousada registra e estorna pagamento, mas não opera pedidos nem lança consumo', () => {
    expect(orderPermissions('financeiro_pousada')).toEqual({
      operate: false,
      charge: false,
      showPrices: true,
      registerPayment: true,
      reversePayment: true,
    })
  })

  it('governança entrega pedidos sem ver preço nem mexer em dinheiro', () => {
    expect(orderPermissions('governanca')).toEqual({
      operate: true,
      charge: false,
      showPrices: false,
      registerPayment: false,
      reversePayment: false,
    })
  })

  it.each<Role>(['proprietario', 'admin_pousada'])('%s pode tudo na conta de consumo', (role) => {
    expect(orderPermissions(role)).toEqual({
      operate: true,
      charge: true,
      showPrices: true,
      registerPayment: true,
      reversePayment: true,
    })
  })

  it.each<Role>(['viajante', 'visitante'])('%s não tem nenhuma permissão de equipe', (role) => {
    expect(Object.values(orderPermissions(role))).toEqual([false, false, false, false, false])
  })
})

describe('reverseConsumptionPayment (estorno de pagamento de consumo)', () => {
  beforeEach(() => {
    mocks.getConsumptionPaymentRef.mockResolvedValue({
      pousadaId: ACTIVE_POUSADA,
      bookingId: BOOKING_ID,
    })
  })

  it('estorna com o motivo e devolve a reserva para a tela ser atualizada', async () => {
    await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).resolves.toEqual({
      bookingId: BOOKING_ID,
    })
    expect(mocks.reverseConsumptionPaymentRpc).toHaveBeenCalledWith(PAYMENT_ID, 'Lançado em dobro')
  })

  it.each<Role>(['proprietario', 'admin_pousada', 'financeiro_pousada'])(
    '%s pode estornar',
    async (role) => {
      signedInAs(role)

      await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).resolves.toEqual({
        bookingId: BOOKING_ID,
      })
    },
  )

  it.each<Role>(['recepcionista', 'governanca'])('%s não estorna pagamento', async (role) => {
    signedInAs(role)

    await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).rejects.toThrow(
      'Você não tem permissão para esta ação.',
    )
    expect(mocks.getConsumptionPaymentRef).not.toHaveBeenCalled()
    expect(mocks.reverseConsumptionPaymentRpc).not.toHaveBeenCalled()
  })

  it('pagamento de OUTRA pousada: "Pagamento não encontrado." e nada é estornado', async () => {
    mocks.getConsumptionPaymentRef.mockResolvedValue({
      pousadaId: OTHER_POUSADA,
      bookingId: BOOKING_ID,
    })

    await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).rejects.toThrow(
      'Pagamento não encontrado.',
    )
    expect(mocks.reverseConsumptionPaymentRpc).not.toHaveBeenCalled()
  })

  it('pagamento inexistente: "Pagamento não encontrado." e nada é estornado', async () => {
    mocks.getConsumptionPaymentRef.mockResolvedValue(null)

    await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).rejects.toThrow(
      'Pagamento não encontrado.',
    )
    expect(mocks.reverseConsumptionPaymentRpc).not.toHaveBeenCalled()
  })

  it('recusa do banco (ex.: já estornado) chega a quem pediu, sem devolver reserva', async () => {
    mocks.reverseConsumptionPaymentRpc.mockRejectedValue(
      new Error('Este pagamento já foi estornado.'),
    )

    await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).rejects.toThrow(
      'Este pagamento já foi estornado.',
    )
  })

  it('sem pousada ativa o estorno é recusado', async () => {
    signedInAs(null, null)

    await expect(reverseConsumptionPayment(PAYMENT_ID, 'Lançado em dobro')).rejects.toThrow(
      'Nenhuma pousada ativa selecionada.',
    )
    expect(mocks.reverseConsumptionPaymentRpc).not.toHaveBeenCalled()
  })
})

describe('registerConsumptionPayment (recebimento da conta de consumo)', () => {
  it('registra o pagamento na reserva da pousada ativa', async () => {
    await registerConsumptionPayment(BOOKING_ID, 85.5, 'pix', 'Pago na saída')

    expect(mocks.bookingPousadaLookup).toHaveBeenCalledWith('bookings', BOOKING_ID)
    expect(mocks.registerConsumptionPaymentRpc).toHaveBeenCalledWith(
      BOOKING_ID,
      85.5,
      'pix',
      'Pago na saída',
    )
  })

  it.each<Role>(['recepcionista', 'financeiro_pousada', 'admin_pousada'])(
    '%s pode registrar pagamento',
    async (role) => {
      signedInAs(role)

      await registerConsumptionPayment(BOOKING_ID, 40, 'dinheiro', '')

      expect(mocks.registerConsumptionPaymentRpc).toHaveBeenCalledTimes(1)
    },
  )

  it('governança não registra pagamento', async () => {
    signedInAs('governanca')

    await expect(registerConsumptionPayment(BOOKING_ID, 40, 'dinheiro', '')).rejects.toThrow(
      'Você não tem permissão para esta ação.',
    )
    expect(mocks.registerConsumptionPaymentRpc).not.toHaveBeenCalled()
  })

  it('reserva de OUTRA pousada: "Reserva não encontrada." e nada é registrado', async () => {
    mocks.bookingPousadaLookup.mockResolvedValue({
      data: { pousada_id: OTHER_POUSADA },
      error: null,
    })

    await expect(registerConsumptionPayment(BOOKING_ID, 40, 'pix', '')).rejects.toThrow(
      'Reserva não encontrada.',
    )
    expect(mocks.registerConsumptionPaymentRpc).not.toHaveBeenCalled()
  })

  it('reserva inexistente (ou invisível pela RLS): nada é registrado', async () => {
    mocks.bookingPousadaLookup.mockResolvedValue({ data: null, error: null })

    await expect(registerConsumptionPayment(BOOKING_ID, 40, 'pix', '')).rejects.toThrow(
      'Reserva não encontrada.',
    )
    expect(mocks.registerConsumptionPaymentRpc).not.toHaveBeenCalled()
  })

  it('falha ao consultar a reserva fecha a porta: nada é registrado', async () => {
    mocks.bookingPousadaLookup.mockResolvedValue({
      data: null,
      error: { message: 'banco indisponível' },
    })

    await expect(registerConsumptionPayment(BOOKING_ID, 40, 'pix', '')).rejects.toThrow()
    expect(mocks.registerConsumptionPaymentRpc).not.toHaveBeenCalled()
  })
})

describe('chargeConsumption (lançar consumo na reserva)', () => {
  const items = [{ itemId: 'item-1', quantity: 2 }]

  it('recepcionista lança consumo na reserva da pousada ativa', async () => {
    signedInAs('recepcionista')
    mocks.staffCreateOrderRpc.mockResolvedValue({ id: 'order-1' })

    await expect(chargeConsumption(BOOKING_ID, items, 'Frigobar')).resolves.toEqual({
      id: 'order-1',
    })
    expect(mocks.staffCreateOrderRpc).toHaveBeenCalledWith(BOOKING_ID, items, 'Frigobar')
  })

  it('governança opera pedidos, mas não lança consumo', async () => {
    signedInAs('governanca')

    await expect(chargeConsumption(BOOKING_ID, items, '')).rejects.toThrow(
      'Seu perfil não pode lançar consumo.',
    )
    expect(mocks.staffCreateOrderRpc).not.toHaveBeenCalled()
  })

  it('reserva de OUTRA pousada: nada é lançado', async () => {
    mocks.bookingPousadaLookup.mockResolvedValue({
      data: { pousada_id: OTHER_POUSADA },
      error: null,
    })

    await expect(chargeConsumption(BOOKING_ID, items, '')).rejects.toThrow(
      'Reserva não encontrada.',
    )
    expect(mocks.staffCreateOrderRpc).not.toHaveBeenCalled()
  })
})

describe('changeOrderStatus', () => {
  it('muda o status de um pedido da pousada ativa', async () => {
    signedInAs('governanca')
    mocks.getOrderPousadaId.mockResolvedValue(ACTIVE_POUSADA)

    await changeOrderStatus('order-1', 'entregue', null)

    expect(mocks.setOrderStatusRpc).toHaveBeenCalledWith('order-1', 'entregue', null)
  })

  it('pedido de OUTRA pousada: "Pedido não encontrado." e o status não muda', async () => {
    mocks.getOrderPousadaId.mockResolvedValue(OTHER_POUSADA)

    await expect(changeOrderStatus('order-1', 'cancelado', 'engano')).rejects.toThrow(
      'Pedido não encontrado.',
    )
    expect(mocks.setOrderStatusRpc).not.toHaveBeenCalled()
  })

  it('financeiro da pousada não opera pedidos', async () => {
    signedInAs('financeiro_pousada')

    await expect(changeOrderStatus('order-1', 'entregue', null)).rejects.toThrow(
      'Você não tem permissão para esta ação.',
    )
    expect(mocks.setOrderStatusRpc).not.toHaveBeenCalled()
  })
})

describe('getBookingConsumption (bloco "Conta de consumo" da reserva)', () => {
  beforeEach(() => {
    mocks.listBookingOrders.mockResolvedValue([])
    mocks.getConsumptionRpc.mockResolvedValue({ delivered: 90, open: 0, paid: 40, balance: 50 })
    mocks.listConsumptionPayments.mockResolvedValue([])
  })

  it('governança não vê a conta — e os valores nem são consultados', async () => {
    signedInAs('governanca')

    await expect(getBookingConsumption(BOOKING_ID)).resolves.toBeNull()
    expect(mocks.getConsumptionRpc).not.toHaveBeenCalled()
    expect(mocks.listConsumptionPayments).not.toHaveBeenCalled()
  })

  it('recepcionista vê a conta com o botão de receber, sem o de estornar', async () => {
    signedInAs('recepcionista')

    const result = await getBookingConsumption(BOOKING_ID)

    expect(result).toMatchObject({
      summary: { balance: 50 },
      canRegisterPayment: true,
      canReversePayment: false,
      canCharge: true,
    })
  })

  it('financeiro da pousada vê a conta e pode estornar, mas não lança consumo', async () => {
    signedInAs('financeiro_pousada')

    expect(await getBookingConsumption(BOOKING_ID)).toMatchObject({
      canRegisterPayment: true,
      canReversePayment: true,
      canCharge: false,
      canOperate: false,
    })
  })

  it('sem pousada ativa não devolve nada', async () => {
    signedInAs(null, null)

    await expect(getBookingConsumption(BOOKING_ID)).resolves.toBeNull()
  })
})

describe('getOrdersScreen (tela de pedidos)', () => {
  const order: GuestOrder = {
    id: 'order-1',
    bookingId: BOOKING_ID,
    bookingCode: 'RP-TESTE1',
    guestName: 'Viajante Teste',
    roomName: 'Duplo',
    status: 'novo',
    source: 'hospede',
    note: '',
    total: 36,
    lines: [
      { itemId: 'item-1', name: 'Água', unit: 'un', unitPrice: 6, quantity: 2, lineTotal: 12 },
      { itemId: 'item-2', name: 'Vinho', unit: 'un', unitPrice: 24, quantity: 1, lineTotal: 24 },
    ],
    createdAt: '2099-10-05T12:00:00Z',
    acceptedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
  }

  beforeEach(() => {
    mocks.listPousadaOrders.mockResolvedValue([order])
    mocks.listReservationsByPousada.mockResolvedValue([])
    mocks.listInventoryItems.mockResolvedValue([])
  })

  it('governança recebe os pedidos com itens e quantidades, mas sem nenhum valor', async () => {
    signedInAs('governanca')

    const screen = await getOrdersScreen('America/Sao_Paulo')

    expect(screen.orders).toHaveLength(1)
    expect(screen.orders[0]?.total).toBe(0)
    expect(screen.orders[0]?.lines).toEqual([
      expect.objectContaining({ name: 'Água', quantity: 2, unitPrice: 0, lineTotal: 0 }),
      expect.objectContaining({ name: 'Vinho', quantity: 1, unitPrice: 0, lineTotal: 0 }),
    ])
  })

  it('governança não carrega reservas nem tabela de preços', async () => {
    signedInAs('governanca')

    const screen = await getOrdersScreen('America/Sao_Paulo')

    expect(mocks.listReservationsByPousada).not.toHaveBeenCalled()
    expect(mocks.listInventoryItems).not.toHaveBeenCalled()
    expect(screen.inHouse).toEqual([])
    expect(screen.sellable).toEqual([])
  })

  it('recepcionista vê os valores dos pedidos', async () => {
    signedInAs('recepcionista')

    const screen = await getOrdersScreen('America/Sao_Paulo')

    expect(screen.orders[0]?.total).toBe(36)
    expect(screen.orders[0]?.lines[0]).toMatchObject({ unitPrice: 6, lineTotal: 12 })
  })

  it('financeiro da pousada não abre a tela de pedidos', async () => {
    signedInAs('financeiro_pousada')

    await expect(getOrdersScreen('America/Sao_Paulo')).rejects.toThrow(
      'Você não tem permissão para esta ação.',
    )
    expect(mocks.listPousadaOrders).not.toHaveBeenCalled()
  })
})
