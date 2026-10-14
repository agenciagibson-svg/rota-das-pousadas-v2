import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncAllFeeds, syncOneFeed } from './sync.service'

const mocks = vi.hoisted(() => ({ listFeeds: vi.fn(), apply: vi.fn() }))
vi.mock('@/repositories/channels.repository', () => ({
  listFeedsToImport: mocks.listFeeds,
  applySyncRpc: mocks.apply,
}))

function feedText(...events: string[]) {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n')
}

const UM_EVENTO = feedText(
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261001',
  'DTEND;VALUE=DATE:20261005',
  'UID:abc',
  'SUMMARY:Reserved',
  'END:VEVENT',
)

describe('syncOneFeed', () => {
  const feed = { calendarId: 'cal-1', importUrl: 'https://exemplo.test/x.ics' }

  beforeEach(() => vi.clearAllMocks())

  it('grava os eventos lidos quando o feed responde', async () => {
    const apply = vi.fn().mockResolvedValue({ status: 'ok', events: 1 })
    const result = await syncOneFeed(feed, { fetchFeed: async () => UM_EVENTO, apply })

    expect(result).toMatchObject({ calendarId: 'cal-1', status: 'ok', events: 1 })
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'cal-1',
        status: 'ok',
        events: [
          expect.objectContaining({ uid: 'abc', startsOn: '2026-10-01', endsOn: '2026-10-05' }),
        ],
      }),
    )
  })

  it('FAIL-CLOSED: feed fora do ar grava erro e NENHUM evento, nunca lista vazia como sucesso', async () => {
    const apply = vi.fn().mockResolvedValue({ status: 'error' })
    const result = await syncOneFeed(feed, {
      fetchFeed: async () => {
        throw new Error('O canal respondeu 503.')
      },
      apply,
    })

    expect(result.status).toBe('error')
    // O detalhe que protege a pousada: status 'error', e não 'ok' com [].
    // 'ok' com lista vazia apagaria os bloqueios e liberaria o quarto.
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', events: [], error: 'O canal respondeu 503.' }),
    )
  })

  it('resposta que não é calendário conta como falha, não como calendário vazio', async () => {
    const apply = vi.fn().mockResolvedValue({ status: 'error' })
    const result = await syncOneFeed(feed, { fetchFeed: async () => '<html>login</html>', apply })

    expect(result.status).toBe('error')
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', events: [] }))
  })

  it('feed legitimamente vazio zera os bloqueios', async () => {
    const apply = vi.fn().mockResolvedValue({ status: 'ok', events: 0 })
    const result = await syncOneFeed(feed, { fetchFeed: async () => feedText(), apply })

    expect(result).toMatchObject({ status: 'ok', events: 0 })
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok', events: [] }))
  })

  it('falha ao gravar também vira erro, sem derrubar a rodada', async () => {
    const apply = vi.fn().mockRejectedValue(new Error('banco indisponível'))
    const result = await syncOneFeed(feed, { fetchFeed: async () => UM_EVENTO, apply })
    expect(result).toMatchObject({ status: 'error', error: 'banco indisponível' })
  })
})

describe('syncAllFeeds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('um canal quebrado não impede os outros de sincronizar', async () => {
    mocks.listFeeds.mockResolvedValue([
      { calendarId: 'bom-1', importUrl: 'https://a.test/1.ics' },
      { calendarId: 'ruim', importUrl: 'https://b.test/2.ics' },
      { calendarId: 'bom-2', importUrl: 'https://c.test/3.ics' },
    ])
    const apply = vi.fn().mockResolvedValue({ status: 'ok' })

    const report = await syncAllFeeds({
      apply,
      fetchFeed: async (url) => {
        if (url.includes('b.test')) throw new Error('timeout')
        return UM_EVENTO
      },
    })

    expect(report).toMatchObject({ total: 3, ok: 2, failed: 1 })
    expect(report.results.map((r) => r.calendarId)).toEqual(['bom-1', 'ruim', 'bom-2'])
  })

  it('sem canais configurados, a rodada não faz nada e não falha', async () => {
    mocks.listFeeds.mockResolvedValue([])
    const report = await syncAllFeeds({ apply: vi.fn(), fetchFeed: vi.fn() })
    expect(report).toMatchObject({ total: 0, ok: 0, failed: 0 })
  })

  it('roda poucos feeds em paralelo, nunca todos de uma vez', async () => {
    mocks.listFeeds.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        calendarId: `c${i}`,
        importUrl: `https://x.test/${i}.ics`,
      })),
    )
    let running = 0
    let peak = 0
    const report = await syncAllFeeds({
      apply: vi.fn().mockResolvedValue({ status: 'ok' }),
      fetchFeed: async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 5))
        running -= 1
        return UM_EVENTO
      },
    })
    expect(report).toMatchObject({ total: 10, ok: 10, skipped: 0 })
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('sem tempo, deixa o resto para a próxima rodada em vez de estourar o limite', async () => {
    mocks.listFeeds.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        calendarId: `c${i}`,
        importUrl: `https://x.test/${i}.ics`,
      })),
    )
    let clock = 0
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const report = await syncAllFeeds({
      apply: vi.fn().mockResolvedValue({ status: 'ok' }),
      // Cada feed "leva" 15 s; o orçamento é de 40 s.
      fetchFeed: async () => {
        clock += 15_000
        return UM_EVENTO
      },
      now: () => clock,
      budgetMs: 40_000,
    })
    warn.mockRestore()
    expect(report.total).toBe(12)
    expect(report.skipped).toBeGreaterThan(0)
    expect(report.ok + report.skipped).toBe(12)
    // Os primeiros da fila (mais antigos) são os que rodam.
    expect(report.results[0].calendarId).toBe('c0')
  })
})
