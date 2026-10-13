import { describe, expect, it } from 'vitest'
import { pousadas } from '@/lib/data'
import { extractCriteria } from './criteria'
import { bookingLinks, searchCatalog } from './search'

const TODAY = '2026-10-13'
const find = (...msgs: string[]) => searchCatalog(pousadas, extractCriteria(msgs, TODAY))

describe('searchCatalog — busca no catálogo de demonstração', () => {
  it('praia + família + pets traz a pousada pé na areia de Trancoso primeiro', () => {
    const [first] = find('praia com a família e o cachorro')
    expect(first!.pousada.slug).toBe('pousada-mare-alta')
    expect(first!.reasons).toEqual(expect.arrayContaining(['praia', 'família', 'pets']))
  })

  it('resort → Ponta Azul; floresta → Ecolodge ou Cabanas da Mata', () => {
    expect(find('quero um resort')[0]!.pousada.slug).toBe('ponta-azul-resort')
    const forest = find('cabana na floresta').map((m) => m.pousada.slug)
    expect(forest[0]).toBe('cabanas-da-mata')
  })

  it('grupo maior que a acomodação não aparece', () => {
    const slugs = find('serra com lareira', 'somos 5 pessoas').map((m) => m.pousada.slug)
    expect(slugs).not.toContain('chales-serra-gelada') // chalés para 2
  })

  it('cidade citada filtra o catálogo', () => {
    const slugs = find('algo em Tiradentes').map((m) => m.pousada.slug)
    expect(slugs).toEqual(['fazenda-serra-azul'])
  })

  it('links de reserva levam datas e hóspedes', () => {
    expect(
      bookingLinks('pousada-mare-alta', {
        checkin: '2026-12-20',
        checkout: '2026-12-23',
        guests: 4,
      }),
    ).toEqual({
      page: '/pousada/pousada-mare-alta?checkin=2026-12-20&checkout=2026-12-23&guests=4',
      reserve:
        '/pousada/pousada-mare-alta/reservar?checkin=2026-12-20&checkout=2026-12-23&guests=4',
    })
    expect(bookingLinks('x', { guests: 2 }).reserve).toBeNull()
  })
})
