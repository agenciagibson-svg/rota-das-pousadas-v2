import { describe, expect, it } from 'vitest'
import {
  demoPath,
  demoWhatsappHref,
  isDemoToken,
  parseDemoResponse,
  timeAgo,
  withoutSeedRating,
} from './demo'
import type { Pousada } from '@/types'

const TOKEN = 'Ab3_Cd4-Ef5Gh6Ij7Kl8Mn9Op0Qr1St2Uv3Wx4Yz5Ab'

describe('isDemoToken', () => {
  it('aceita só o formato do banco', () => {
    expect(isDemoToken(TOKEN)).toBe(true)
    expect(isDemoToken('curto')).toBe(false)
    expect(isDemoToken(`${TOKEN}/../admin`)).toBe(false)
    expect(isDemoToken(null)).toBe(false)
    expect(isDemoToken(123)).toBe(false)
  })
})

describe('links', () => {
  it('monta o caminho e a mensagem do WhatsApp', () => {
    expect(demoPath(TOKEN)).toBe(`/demo/${TOKEN}`)
    const href = demoWhatsappHref('Pousada Exemplo & Cia', 'https://rotadaspousadas.com.br/demo/x')
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    const text = decodeURIComponent(href.split('text=')[1] ?? '')
    expect(text).toContain('Pousada Exemplo & Cia')
    expect(text).toContain('https://rotadaspousadas.com.br/demo/x')
  })
})

describe('parseDemoResponse', () => {
  it('pousada já publicada vira redirecionamento', () => {
    expect(parseDemoResponse({ published: true, slug: 'serra' })).toEqual({
      kind: 'published',
      slug: 'serra',
    })
    expect(parseDemoResponse({ published: true })).toBeNull()
  })

  it('link desativado, inválido ou resposta estranha: nada', () => {
    expect(parseDemoResponse(null)).toBeNull()
    expect(parseDemoResponse('x')).toBeNull()
    expect(parseDemoResponse({ published: false })).toBeNull()
    expect(parseDemoResponse({ published: false, pousada: { name: 'Sem slug' } })).toBeNull()
  })

  it('lê a pousada e as acomodações, descartando linhas quebradas', () => {
    const parsed = parseDemoResponse({
      published: false,
      pousada: { slug: 'mirante', name: 'Mirante' },
      rooms: [
        {
          id: 'r1',
          name: 'Chalé',
          description: 'Lareira',
          base_price: 590,
          capacity: 2,
          gallery: ['a.jpg', 3],
        },
        { id: 'r2', name: 'Sem preço', base_price: 'x', capacity: 2 },
        { name: 'Sem id', base_price: 100, capacity: 2 },
      ],
    })
    expect(parsed?.kind).toBe('demo')
    if (parsed?.kind !== 'demo') return
    expect(parsed.rooms).toEqual([
      {
        id: 'r1',
        name: 'Chalé',
        description: 'Lareira',
        capacity: 2,
        nightly: 590,
        gallery: ['a.jpg'],
        stayTotal: null,
        minNights: 1,
      },
    ])
  })
})

describe('withoutSeedRating', () => {
  const base = { rating: 4.9, reviews: 0 } as Pousada
  it('sem avaliação real, nota zerada', () => {
    expect(withoutSeedRating(base).rating).toBe(0)
  })
  it('com avaliação real, mantém', () => {
    expect(withoutSeedRating({ ...base, reviews: 3 }).rating).toBe(4.9)
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-11-09T15:00:00Z')
  it('fala em minutos, horas e dias', () => {
    expect(timeAgo('2026-11-09T14:59:40Z', now)).toBe('agora há pouco')
    expect(timeAgo('2026-11-09T14:40:00Z', now)).toBe('há 20 min')
    expect(timeAgo('2026-11-09T12:00:00Z', now)).toBe('há 3 h')
    expect(timeAgo('2026-11-08T14:00:00Z', now)).toBe('há 1 dia')
    expect(timeAgo('2026-11-04T14:00:00Z', now)).toBe('há 5 dias')
  })
})
