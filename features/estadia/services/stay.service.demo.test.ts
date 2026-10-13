import { describe, expect, it, vi } from 'vitest'

// Modo demonstração (preview sem Supabase): o app da estadia abre uma estadia
// de exemplo em vez de exigir login e uma reserva confirmada.
vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => false,
  publicEnv: { siteUrl: 'http://localhost:3000', supabaseUrl: '', supabaseAnonKey: '' },
}))
const createClient = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: createClient }))
vi.mock('next/server', () => ({ connection: async () => {} }))

describe('app da estadia no modo demonstração', () => {
  it('lista a estadia de exemplo, em curso hoje', async () => {
    const { listMyStays } = await import('./stay.service')
    const { DEMO_STAY_ID } = await import('../demo')
    const stays = await listMyStays()

    expect(stays).toHaveLength(1)
    expect(stays[0]).toMatchObject({ id: DEMO_STAY_ID, pousadaName: 'Refúgio das Nuvens' })
    expect(stays[0]!.checkin <= stays[0]!.checkout).toBe(true)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('abre a estadia de exemplo com cardápio e um pedido entregue', async () => {
    const { getStay } = await import('./stay.service')
    const { DEMO_STAY_ID } = await import('../demo')
    const data = await getStay(DEMO_STAY_ID)

    expect(data?.stay.pousada.name).toBe('Refúgio das Nuvens')
    expect(data?.stay.canOrder).toBe(true)
    expect(data?.stay.menu.length).toBeGreaterThan(2)
    expect(data?.orders[0]).toMatchObject({ status: 'entregue' })
    // Conta coerente: o consumido é o total dos pedidos entregues.
    expect(data?.stay.consumption.delivered).toBe(data?.orders[0]!.total)
    expect(await getStay('11111111-1111-4111-8111-111111111111')).toBeNull()

    // Os ids passam pela validação das ações (pedir, cancelar, avaliar).
    const { cancelOrderSchema, placeOrderSchema } = await import('@/features/pedidos/schemas')
    const item = data!.stay.menu[0]!
    expect(
      placeOrderSchema.safeParse({
        bookingId: DEMO_STAY_ID,
        items: [{ itemId: item.id, quantity: 1 }],
      }).success,
    ).toBe(true)
    expect(cancelOrderSchema.safeParse({ orderId: data!.orders[0]!.id }).success).toBe(true)
  })

  it('pedido e avaliação não tocam no banco', async () => {
    const { placeOrder, submitReview } = await import('./stay.service')
    const { DEMO_STAY_ID } = await import('../demo')

    await expect(
      placeOrder(DEMO_STAY_ID, [{ itemId: 'x', quantity: 1 }], ''),
    ).resolves.toMatchObject({
      orderId: expect.any(String),
    })
    await expect(submitReview(DEMO_STAY_ID, 5, '')).resolves.toBeUndefined()
    expect(createClient).not.toHaveBeenCalled()
  })
})
