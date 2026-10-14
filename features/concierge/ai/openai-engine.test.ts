import { describe, expect, it, vi } from 'vitest'
import { pousadas } from '@/lib/data'
import { openaiConcierge } from './openai-engine'

const TODAY = '2026-10-13'

type Body = { messages: { role: string; content?: string | null; tool_call_id?: string }[] }

/** Simula a API: cada chamada devolve a próxima mensagem do roteiro. */
function scriptedFetch(script: object[]) {
  const bodies: Body[] = []
  const impl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Body)
    const message = script[bodies.length - 1]
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 })
  })
  return { impl: impl as unknown as typeof fetch, bodies }
}

const call = (id: string, name: string, args: object) => ({
  content: null,
  tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
})

describe('openaiConcierge — ferramentas sobre o catálogo', () => {
  it('busca, mostra cartões montados no servidor e devolve a resposta do modelo', async () => {
    const { impl, bodies } = scriptedFetch([
      call('c1', 'buscar_pousadas', { palavras_chave: ['praia', 'pets'], hospedes: 4 }),
      call('c2', 'mostrar_opcoes', {
        slugs: ['pousada-mare-alta', 'nao-existe'],
        checkin: '2026-12-20',
        checkout: '2026-12-23',
        hospedes: 4,
      }),
      { content: 'A Maré Alta combina: R$ 1.620 no total. Toque em “Reservar agora”.' },
    ])

    const r = await openaiConcierge({
      messages: [{ role: 'user', content: 'praia com pets, somos 4, de 20/12 a 23/12' }],
      pousadas,
      today: TODAY,
      apiKey: 'sk-teste-sintetico',
      fetchImpl: impl,
    })

    expect(r.engine).toBe('openai')
    expect(r.reply).toMatch(/Maré Alta/)
    // Slug inventado é descartado; link e total vêm do servidor.
    expect(r.cards.map((c) => c.slug)).toEqual(['pousada-mare-alta'])
    expect(r.cards[0]!.total).toBe(3 * 540)
    expect(r.cards[0]!.reserveHref).toBe(
      '/pousada/pousada-mare-alta/reservar?checkin=2026-12-20&checkout=2026-12-23&guests=4',
    )

    // O resultado da busca volta ao modelo como mensagem de ferramenta, com dados reais.
    const toolMsg = bodies[1]!.messages.find((m) => m.role === 'tool')!
    expect(toolMsg.tool_call_id).toBe('c1')
    expect(JSON.parse(toolMsg.content!).pousadas[0].slug).toBe('pousada-mare-alta')
  })

  it('datas no passado: cartão sem link de reserva', async () => {
    const { impl } = scriptedFetch([
      call('c1', 'mostrar_opcoes', {
        slugs: ['pousada-mare-alta'],
        checkin: '2026-01-10',
        checkout: '2026-01-12',
      }),
      { content: 'Essa data já passou. Para quando seria?' },
    ])
    const r = await openaiConcierge({
      messages: [{ role: 'user', content: 'praia' }],
      pousadas,
      today: TODAY,
      apiKey: 'sk-teste-sintetico',
      fetchImpl: impl,
    })
    expect(r.cards[0]!.reserveHref).toBeNull()
    expect(r.cards[0]!.total).toBeNull()
  })

  it('erro da API vira exceção (a rota cai no modo local)', async () => {
    const impl = vi.fn(
      async () => new Response('quota', { status: 429 }),
    ) as unknown as typeof fetch
    await expect(
      openaiConcierge({
        messages: [{ role: 'user', content: 'praia' }],
        pousadas,
        today: TODAY,
        apiKey: 'sk-teste-sintetico',
        fetchImpl: impl,
      }),
    ).rejects.toThrow(/429/)
  })
})
