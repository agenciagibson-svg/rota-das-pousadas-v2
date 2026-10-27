import { describe, expect, it } from 'vitest'
import { geocodeAddressActionSchema, pousadaLocationSchema } from './schemas'
import { geocodeMessage, samePoint } from './components/location-messages'

describe('pousadaLocationSchema (Server Action do ponto no mapa)', () => {
  it('aceita um ponto no Brasil ou null (apagar)', () => {
    expect(pousadaLocationSchema.safeParse({ location: { lat: -21.7, lng: -44.9 } }).success).toBe(
      true,
    )
    expect(pousadaLocationSchema.safeParse({ location: null }).success).toBe(true)
  })

  it('recusa fora do Brasil, campos a mais e formato errado', () => {
    expect(pousadaLocationSchema.safeParse({ location: { lat: 38.7, lng: -9.1 } }).success).toBe(
      false,
    )
    expect(pousadaLocationSchema.safeParse({ location: null, pousadaId: 'outra' }).success).toBe(
      false,
    )
    expect(pousadaLocationSchema.safeParse({ location: '-21.7,-44.9' }).success).toBe(false)
    expect(pousadaLocationSchema.safeParse({}).success).toBe(false)
  })

  it('a busca pelo endereço não aceita texto do navegador', () => {
    expect(geocodeAddressActionSchema.safeParse({}).success).toBe(true)
    expect(geocodeAddressActionSchema.safeParse({ q: 'qualquer endereço' }).success).toBe(false)
  })
})

describe('mensagens da busca pelo endereço', () => {
  it('diz quando achou só a cidade, para o dono ajustar o alfinete', () => {
    expect(
      geocodeMessage({
        status: 'found',
        point: { lat: -21.7, lng: -44.9 },
        precision: 'cidade',
        label: '',
      }),
    ).toMatch(/só a cidade/)
    expect(geocodeMessage({ status: 'not_found' })).toMatch(/clicando no mapa/)
    expect(geocodeMessage({ status: 'unavailable' })).toMatch(/clicando no mapa/)
  })

  it('samePoint compara ponto salvo e ponto na tela', () => {
    expect(samePoint(null, null)).toBe(true)
    expect(samePoint({ lat: 1, lng: 2 }, null)).toBe(false)
    expect(samePoint({ lat: -21.7, lng: -44.9 }, { lat: -21.7, lng: -44.9 })).toBe(true)
  })
})
