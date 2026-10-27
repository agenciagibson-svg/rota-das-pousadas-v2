import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BRAZIL_BOUNDS,
  boundsOf,
  directionsLinks,
  geoPointSchema,
  isInsideBrazil,
  parseCoordinatesText,
  pointFromColumns,
  roundPoint,
} from './coordinates'

// Pontos sintéticos perto dos extremos do Brasil e fora dele.
const CHUI = { lat: -33.74, lng: -53.37 }
const CABURAI = { lat: 5.27, lng: -60.21 }
const SERRA_DO_DIVISOR = { lat: -7.53, lng: -73.98 }
const TRINDADE = { lat: -20.51, lng: -29.32 }
const NORONHA = { lat: -3.85, lng: -32.42 }
const LISBOA = { lat: 38.72, lng: -9.14 }
const BUENOS_AIRES = { lat: -34.6, lng: -58.38 }

describe('isInsideBrazil', () => {
  it('aceita os extremos do país e as ilhas', () => {
    for (const p of [CHUI, CABURAI, SERRA_DO_DIVISOR, TRINDADE, NORONHA]) {
      expect(isInsideBrazil(p)).toBe(true)
    }
  })

  it('recusa fora da caixa, NaN e infinito', () => {
    expect(isInsideBrazil(LISBOA)).toBe(false)
    expect(isInsideBrazil({ lat: 0, lng: 0 })).toBe(false)
    expect(isInsideBrazil({ lat: Number.NaN, lng: -45 })).toBe(false)
    expect(isInsideBrazil({ lat: -20, lng: Number.POSITIVE_INFINITY })).toBe(false)
    // Lat/lng trocados (erro comum ao colar) caem fora.
    expect(isInsideBrazil({ lat: -44.1, lng: -21.1 })).toBe(false)
  })

  it('é uma caixa com folga, não a fronteira: pega erro grosseiro, não o vizinho de perto', () => {
    // Buenos Aires está fora do Brasil, mas dentro da caixa — aceito de propósito.
    expect(isInsideBrazil(BUENOS_AIRES)).toBe(true)
  })
})

describe('geoPointSchema (validação no servidor)', () => {
  it('aceita um ponto válido', () => {
    expect(geoPointSchema.safeParse({ lat: -21.1, lng: -44.2 }).success).toBe(true)
  })

  it('recusa texto, campos a mais, NaN e fora do Brasil', () => {
    expect(geoPointSchema.safeParse({ lat: '-21.1', lng: -44.2 }).success).toBe(false)
    expect(geoPointSchema.safeParse({ lat: -21.1, lng: -44.2, extra: 1 }).success).toBe(false)
    expect(geoPointSchema.safeParse({ lat: Number.NaN, lng: -44.2 }).success).toBe(false)
    const fora = geoPointSchema.safeParse(LISBOA)
    expect(fora.success).toBe(false)
    expect(fora.error?.issues[0]?.message).toBe('O ponto precisa ficar dentro do Brasil.')
  })
})

describe('pointFromColumns', () => {
  it('lê numeric do banco como número ou texto', () => {
    expect(pointFromColumns(-21.123456, -44.654321)).toEqual({ lat: -21.123456, lng: -44.654321 })
    expect(pointFromColumns('-21.123456', '-44.654321')).toEqual({
      lat: -21.123456,
      lng: -44.654321,
    })
  })

  it('sem par completo ou com valor estranho, não há ponto (e não há mapa)', () => {
    expect(pointFromColumns(null, null)).toBeNull()
    expect(pointFromColumns(-21, null)).toBeNull()
    expect(pointFromColumns(undefined, -44)).toBeNull()
    expect(pointFromColumns('', '')).toBeNull()
    expect(pointFromColumns('abc', '-44')).toBeNull()
    expect(pointFromColumns(38.7, -9.1)).toBeNull()
  })
})

describe('roundPoint', () => {
  it('guarda 6 casas (o que cabe em numeric(9,6))', () => {
    expect(roundPoint({ lat: -21.1234567891, lng: -44.9876543219 })).toEqual({
      lat: -21.123457,
      lng: -44.987654,
    })
  })
})

describe('boundsOf', () => {
  it('sem pontos ou com um só, não há caixa', () => {
    expect(boundsOf([])).toBeNull()
    expect(boundsOf([CHUI])).toBeNull()
    expect(boundsOf([CHUI, { ...CHUI }])).toBeNull()
  })

  it('caixa [[oeste, sul], [leste, norte]] com todos os pontos', () => {
    expect(boundsOf([CHUI, CABURAI, NORONHA])).toEqual([
      [CABURAI.lng, CHUI.lat],
      [NORONHA.lng, CABURAI.lat],
    ])
  })
})

describe('directionsLinks', () => {
  it('com ponto, Maps e Waze vão direto às coordenadas', () => {
    const links = directionsLinks({ lat: -21.1, lng: -44.2 }, 'Rua A, 10')
    expect(links?.googleMaps).toBe('https://www.google.com/maps/search/?api=1&query=-21.1%2C-44.2')
    expect(links?.waze).toBe('https://waze.com/ul?ll=-21.1%2C-44.2&navigate=yes')
  })

  it('sem ponto, buscam pelo endereço; sem endereço, não há link', () => {
    expect(directionsLinks(null, 'Rua A, 10 - Cidade')?.googleMaps).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20A%2C%2010%20-%20Cidade',
    )
    expect(directionsLinks(null, '   ')).toBeNull()
  })
})

describe('parseCoordinatesText', () => {
  it('entende o formato do Google Maps e variações', () => {
    expect(parseCoordinatesText('-21.123456, -44.654321')).toEqual({
      lat: -21.123456,
      lng: -44.654321,
    })
    expect(parseCoordinatesText('  -21.1 -44.2 ')).toEqual({ lat: -21.1, lng: -44.2 })
    expect(parseCoordinatesText('-21,123; -44,456')).toEqual({ lat: -21.123, lng: -44.456 })
  })

  it('recusa lixo, números demais e pontos fora do Brasil', () => {
    expect(parseCoordinatesText('')).toBeNull()
    expect(parseCoordinatesText('Rua das Flores, 10')).toBeNull()
    expect(parseCoordinatesText('-21.1, -44.2, 3')).toBeNull()
    expect(parseCoordinatesText('-21,1, -44,2')).toBeNull()
    expect(parseCoordinatesText('38.72, -9.14')).toBeNull()
  })
})

describe('caixa do Brasil igual no código e no banco (0095)', () => {
  it('a constraint pousadas_coordenadas_brasil usa os mesmos limites', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/0095_mapa_pousada.sql'),
      'utf8',
    )
    const lat = /latitude between (-?[\d.]+) and (-?[\d.]+)/.exec(sql)
    const lng = /longitude between (-?[\d.]+) and (-?[\d.]+)/.exec(sql)
    expect(lat && [Number(lat[1]), Number(lat[2])]).toEqual([
      BRAZIL_BOUNDS.minLat,
      BRAZIL_BOUNDS.maxLat,
    ])
    expect(lng && [Number(lng[1]), Number(lng[2])]).toEqual([
      BRAZIL_BOUNDS.minLng,
      BRAZIL_BOUNDS.maxLng,
    ])
  })
})
