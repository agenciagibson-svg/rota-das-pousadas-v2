import { describe, expect, it } from 'vitest'
import { pousadas } from '@/lib/data'
import { localConcierge } from './local-engine'
import type { ChatMessage } from './types'

const TODAY = '2026-10-13'
const user = (...texts: string[]): ChatMessage[] =>
  texts.map((content) => ({ role: 'user', content }))

describe('localConcierge — conduz até a reserva', () => {
  it('sem estilo: cumprimenta e oferece atalhos', () => {
    const r = localConcierge(user('oi'), pousadas, TODAY)
    expect(r.cards).toHaveLength(0)
    expect(r.quickReplies).toContain('Praia com a família')
  })

  it('com estilo e sem pessoas: mostra opções e pergunta quantas pessoas', () => {
    const r = localConcierge(user('praia com pets'), pousadas, TODAY)
    expect(r.cards[0]!.slug).toBe('pousada-mare-alta')
    expect(r.reply).toMatch(/Quantas pessoas/)
    expect(r.cards[0]!.reserveHref).toBeNull()
  })

  it('com pessoas e sem datas: pergunta as datas', () => {
    const r = localConcierge(user('praia com pets', 'somos 4'), pousadas, TODAY)
    expect(r.reply).toMatch(/quais datas/)
  })

  it('com tudo: total estimado e link direto para reservar', () => {
    const r = localConcierge(user('praia com pets', 'somos 4', 'de 20/12 a 23/12'), pousadas, TODAY)
    const first = r.cards[0]!
    expect(first.nights).toBe(3)
    expect(first.total).toBe(3 * 540)
    expect(first.reserveHref).toBe(
      '/pousada/pousada-mare-alta/reservar?checkin=2026-12-20&checkout=2026-12-23&guests=4',
    )
    expect(r.reply).toMatch(/Reservar agora/)
  })
})
