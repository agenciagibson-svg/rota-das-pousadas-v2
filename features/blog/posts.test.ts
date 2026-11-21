import { describe, expect, it } from 'vitest'
import {
  ALL_POSTS,
  findPost,
  parseInline,
  postsForCity,
  readingMinutes,
  showDrafts,
  visiblePosts,
} from './posts'
import { commons } from './photos'

describe('blog', () => {
  it('rascunho só aparece fora da produção', () => {
    expect(showDrafts('production')).toBe(false)
    expect(showDrafts('preview')).toBe(true)
    expect(showDrafts(undefined)).toBe(true)
    const draft = ALL_POSTS.find((p) => p.status === 'rascunho')
    if (draft) {
      expect(findPost(draft.slug, false)).toBeNull()
      expect(findPost(draft.slug, true)?.slug).toBe(draft.slug)
      expect(visiblePosts(false).some((p) => p.slug === draft.slug)).toBe(false)
    }
  })

  it('cada texto tem slug de URL, capa com crédito e cidades válidas', () => {
    const slugs = new Set<string>()
    for (const p of ALL_POSTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/)
      expect(slugs.has(p.slug)).toBe(false)
      slugs.add(p.slug)
      expect(p.description.length).toBeLessThanOrEqual(170)
      expect(p.cover.credit).toBeTruthy()
      expect(p.cover.license).toBeTruthy()
      for (const c of p.cities) expect(c.slug).toMatch(/^[a-z0-9-]+-[a-z]{2}$/)
      expect(readingMinutes(p)).toBeGreaterThan(0)
    }
    expect(postsForCity('sao-roque-de-minas-mg', true).length).toBeGreaterThan(0)
  })

  it('negrito e link no texto', () => {
    expect(parseInline('Veja **a cachoeira** e [as pousadas](/pousadas).')).toEqual([
      { kind: 'text', text: 'Veja ' },
      { kind: 'bold', text: 'a cachoeira' },
      { kind: 'text', text: ' e ' },
      { kind: 'link', text: 'as pousadas', href: '/pousadas' },
      { kind: 'text', text: '.' },
    ])
  })

  it('URL do Commons no formato das miniaturas', () => {
    const p = commons({
      file: "Casca_D'anta,_baixa.jpg",
      hash: 'c/c5',
      alt: 'x',
      credit: 'y',
      license: 'CC BY-SA 4.0',
    })
    expect(p.src).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Casca_D%27anta%2C_baixa.jpg/1920px-Casca_D%27anta%2C_baixa.jpg',
    )
  })
})

describe('guia tirado do ar pelo painel (0113)', () => {
  const slug = ALL_POSTS.find((p) => p.status === 'publicado')!.slug
  const hidden = new Set([slug])

  it('some da lista, da busca pelo endereço e das cidades', () => {
    expect(visiblePosts(false).some((p) => p.slug === slug)).toBe(true)
    expect(visiblePosts(false, hidden).some((p) => p.slug === slug)).toBe(false)
    expect(findPost(slug, false, hidden)).toBeNull()
    const city = ALL_POSTS.find((p) => p.slug === slug)!.cities[0]!.slug
    expect(postsForCity(city, true, hidden).some((p) => p.slug === slug)).toBe(false)
  })

  it('some também na versão de teste', () => {
    expect(visiblePosts(true, hidden).some((p) => p.slug === slug)).toBe(false)
  })
})
