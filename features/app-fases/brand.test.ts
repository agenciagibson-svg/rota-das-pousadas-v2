import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACCENT_INK, APP_ACCENTS, accentHex, contrastRatio, isAppAccent } from './brand'
import { parseGuestStay } from '@/features/estadia/types'
import { guestSettingsSchema } from '@/features/pedidos/schemas'

describe('cor da pousada no app', () => {
  it('toda cor da paleta é legível com o texto escuro do app (WCAG AA, 4.5:1)', () => {
    for (const [key, { hex }] of Object.entries(APP_ACCENTS)) {
      expect(contrastRatio(hex, ACCENT_INK), key).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('a paleta é a mesma do check do banco (0110)', () => {
    const sql = readFileSync('supabase/migrations/0110_cara_da_pousada_no_app.sql', 'utf8')
    const keys = /app_accent in \(([^)]*)\)/.exec(sql)![1]!.match(/'([a-z]*)'/g)!
    expect(keys.map((k) => k.slice(1, -1)).filter(Boolean)).toEqual(Object.keys(APP_ACCENTS))
  })

  it('Ipê, vazio e lixo ficam com a cor da Rota', () => {
    expect(accentHex('capim')).toBe(APP_ACCENTS.capim.hex)
    expect(accentHex('ipe')).toBeNull()
    expect(accentHex('')).toBeNull()
    expect(accentHex('#ff0000')).toBeNull()
    expect(isAppAccent('toString')).toBe(false)
  })
})

const raw = (brand?: unknown, image: string | null = 'https://exemplo.test/p.jpg') => ({
  booking: { id: 'b', status: 'checked_in' },
  pousada: { id: 'p', name: 'Pousada', image },
  ...(brand === undefined ? {} : { brand }),
})

describe('cara da pousada vinda do banco', () => {
  it('sem a 0110: capa é a foto da pousada, sem logo nem cor', () => {
    expect(parseGuestStay(raw()).brand).toEqual({
      logoUrl: null,
      coverUrl: 'https://exemplo.test/p.jpg',
      accent: null,
    })
  })

  it('logo, capa e cor configurados', () => {
    const brand = parseGuestStay(
      raw({ logoUrl: '/logo.png', coverUrl: 'https://exemplo.test/c.jpg', accent: 'ceu' }),
    ).brand
    expect(brand).toEqual({
      logoUrl: '/logo.png',
      coverUrl: 'https://exemplo.test/c.jpg',
      accent: 'ceu',
    })
  })

  it('endereço estranho e cor fora da paleta são ignorados', () => {
    const brand = parseGuestStay(
      raw({ logoUrl: 'javascript:alert(1)', coverUrl: '//outro.site/x.jpg', accent: 'neon' }, null),
    ).brand
    expect(brand).toEqual({ logoUrl: null, coverUrl: null, accent: null })
  })
})

describe('cadastro da cara do app', () => {
  const base = {
    wifiName: '',
    wifiPassword: '',
    guestInfo: '',
    ordersEnabled: true,
    ordersHours: '',
  }

  it('aceita foto do painel e cor da paleta', () => {
    const r = guestSettingsSchema.safeParse({
      ...base,
      appLogoUrl: '/placeholder.svg',
      appCoverUrl: '',
      appAccent: 'lavanda',
    })
    expect(r.success).toBe(true)
  })

  it('recusa foto de outro site e cor solta', () => {
    expect(
      guestSettingsSchema.safeParse({ ...base, appLogoUrl: 'https://outro.site/logo.png' }).success,
    ).toBe(false)
    expect(guestSettingsSchema.safeParse({ ...base, appAccent: '#123456' }).success).toBe(false)
  })
})
