import { describe, expect, it, vi } from 'vitest'
import { isInsideBrazil } from '@/lib/geo/coordinates'
import { ALL_POSTS } from './posts'
import { PLACES } from './places'
import { moderateTipSchema, tipFormSchema, TIP_PHOTO_MAX_BYTES } from './schemas'
import { directionsHref } from './components/place-card'

vi.mock('server-only', () => ({}))

function form(fields: Record<string, string | Blob>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const valid = {
  postSlug: 'pirenopolis-o-que-fazer-cachoeiras-centro-historico',
  authorName: 'Ana',
  authorCity: 'Uberlândia',
  body: 'Chegue cedo na cachoeira, antes das 9h fica vazia.',
  consent: 'on',
  turnstileToken: 'token',
}

describe('mapa dos guias', () => {
  it('todo ponto está no Brasil e todo guia publicado tem mapa', () => {
    for (const place of Object.values(PLACES)) expect(isInsideBrazil(place.point)).toBe(true)
    for (const post of ALL_POSTS) expect(post.places?.length ?? 0).toBeGreaterThan(0)
  })

  it('"Como chegar" abre a rota no Google Maps', () => {
    expect(directionsHref(PLACES.abade)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-15.83921,-48.885',
    )
  })
})

describe('dica do leitor', () => {
  it('aceita a dica sem foto e limpa os espaços', () => {
    const parsed = tipFormSchema.parse(form({ ...valid, authorName: '  Ana  ' }))
    expect(parsed.authorName).toBe('Ana')
    expect(parsed.photo).toBeNull()
    expect(parsed.consent).toBe(true)
  })

  it('arquivo vazio do campo de foto conta como sem foto', () => {
    const parsed = tipFormSchema.parse(form({ ...valid, photo: new Blob([]) }))
    expect(parsed.photo).toBeNull()
  })

  it('recusa sem autorização, dica curta e guia inválido', () => {
    const { consent: _c, ...noConsent } = valid
    const r1 = tipFormSchema.safeParse(form(noConsent))
    expect(r1.success).toBe(false)
    expect(r1.error?.issues[0]?.path).toEqual(['consent'])
    expect(tipFormSchema.safeParse(form({ ...valid, body: 'curta' })).success).toBe(false)
    expect(tipFormSchema.safeParse(form({ ...valid, postSlug: '../admin' })).success).toBe(false)
  })

  it('foto só em JPEG e até o limite', () => {
    const png = new Blob(['x'], { type: 'image/png' })
    expect(tipFormSchema.safeParse(form({ ...valid, photo: png })).success).toBe(false)
    const big = new Blob([new Uint8Array(TIP_PHOTO_MAX_BYTES + 1)], { type: 'image/jpeg' })
    expect(tipFormSchema.safeParse(form({ ...valid, photo: big })).success).toBe(false)
    const ok = new Blob([new Uint8Array(1000)], { type: 'image/jpeg' })
    expect(tipFormSchema.parse(form({ ...valid, photo: ok })).photo?.size).toBe(1000)
  })

  it('moderação só aprova ou recusa', () => {
    const id = '00000000-0000-0000-0000-000000000001'
    expect(moderateTipSchema.safeParse({ id, status: 'aprovada' }).success).toBe(true)
    expect(moderateTipSchema.safeParse({ id, status: 'pendente' }).success).toBe(false)
  })
})
