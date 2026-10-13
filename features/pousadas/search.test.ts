import { describe, expect, it } from 'vitest'
import { catalogQuerySchema, normalizeCatalogText, singleParam } from './search'

describe('filtros públicos', () => {
  it('valida período, hóspedes e página da URL', () => {
    expect(
      catalogQuerySchema.parse({
        checkin: '2099-10-01',
        checkout: '2099-10-03',
        guests: '4',
        page: '2',
      }),
    ).toMatchObject({ guests: 4, page: 2, pageSize: 24 })
  })
  it.each([
    { checkin: '2099-10-01' },
    { checkin: '2099-02-30', checkout: '2099-03-02' },
    { checkin: '2099-10-03', checkout: '2099-10-01' },
    { guests: 0 },
    { guests: 1.5 },
    { page: -1 },
    { pageSize: 101 },
  ])('rejeita filtros inválidos: %j', (input) => {
    expect(catalogQuerySchema.safeParse(input).success).toBe(false)
  })
  it('normaliza acentos, caixa e espaços preservando pontuação literal', () => {
    expect(normalizeCatalogText('  São Tomé, Chalé (%)  ')).toBe('sao tome, chale (%)')
  })
})

describe('singleParam', () => {
  it('fica com o último valor preenchido quando o parâmetro vem repetido', () => {
    // Sugestão da estação na home: o campo vazio e o botão mandam `busca` juntos.
    expect(singleParam(['', 'Serra'])).toBe('Serra')
    expect(singleParam(['Praia', 'Serra'])).toBe('Serra')
    expect(singleParam(['Serra', ''])).toBe('Serra')
  })

  it('mantém valor único e trata ausência', () => {
    expect(singleParam('Serra')).toBe('Serra')
    expect(singleParam(undefined)).toBeUndefined()
    expect(singleParam(['', ''])).toBe('')
  })
})
