import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const listPousadas = vi.fn()
let offline = false
vi.mock('@/services/pousadas.service', () => ({
  listPousadas: async (q: unknown) => {
    if (offline) throw new Error('fora do ar')
    return listPousadas(q)
  },
}))

import { holidayStays } from './holiday-stays.service'

const pousada = (slug: string, city: string) => ({ slug, city }) as never

describe('pousadas livres no próximo feriadão', () => {
  beforeEach(() => {
    listPousadas.mockReset()
    offline = false
  })

  it('busca a cidade nas datas do próximo feriadão e fica só com a cidade certa', async () => {
    listPousadas.mockResolvedValue({
      items: [pousada('a', 'Pirenópolis'), pousada('b', 'Corumbá de Goiás')],
    })
    const result = await holidayStays('Pirenópolis', '2026-11-20')
    expect(result?.weekend.slug).toBe('natal')
    expect(listPousadas).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Pirenópolis',
        checkin: result?.weekend.checkin,
        checkout: result?.weekend.checkout,
        guests: 2,
      }),
    )
    expect(result?.stays.map((p) => p.slug)).toEqual(['a'])
  })

  it('pula o feriadão que começa em menos de 2 dias', async () => {
    listPousadas.mockResolvedValue({ items: [] })
    const natal = await holidayStays('Pirenópolis', '2026-11-20')
    const tooLate = await holidayStays('Pirenópolis', natal!.weekend.checkin)
    expect(tooLate?.weekend.slug).not.toBe('natal')
  })

  it('falha na busca não derruba o guia', async () => {
    offline = true
    const result = await holidayStays('Pirenópolis', '2026-11-20')
    expect(result?.stays).toEqual([])
    expect(result?.weekend).toBeTruthy()
  })
})
