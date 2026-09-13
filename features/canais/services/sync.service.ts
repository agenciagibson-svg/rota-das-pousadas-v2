import 'server-only'
import { parseICalendar, type ChannelEvent } from '../ical'
import type { ChannelFeedToImport, ChannelSyncResult } from '../types'
import { applySyncRpc, listFeedsToImport } from '@/repositories/channels.repository'

/**
 * Importação dos calendários das OTAs.
 *
 * As dependências de I/O entram por parâmetro (`deps`) para que a lógica de
 * decisão — o que conta como falha, o que é preservado, quantos eventos
 * sobrevivem — seja testável sem rede e sem banco. É o mesmo motivo de
 * `availability-engine` receber a leitura de reservas em vez de buscá-la.
 */

/** Um feed maior que isto é tratado como falha: OTA não publica calendário assim. */
const MAX_FEED_BYTES = 2_000_000
const FEED_TIMEOUT_MS = 15_000

export type SyncDeps = {
  fetchFeed: (url: string) => Promise<string>
  apply: (p: {
    calendarId: string
    events: ChannelEvent[]
    status: 'ok' | 'error'
    error: string
  }) => Promise<unknown>
}

/** Busca o texto de um feed com timeout e teto de tamanho. */
export async function fetchFeedText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    cache: 'no-store',
    redirect: 'follow',
    headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
  })
  if (!response.ok) throw new Error(`O canal respondeu ${response.status}.`)

  const length = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_FEED_BYTES) {
    throw new Error('Calendário grande demais para ser processado.')
  }
  const text = await response.text()
  if (text.length > MAX_FEED_BYTES) throw new Error('Calendário grande demais para ser processado.')
  return text
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300)
  return 'Falha desconhecida ao sincronizar o canal.'
}

/**
 * Sincroniza UM feed. Nunca lança: a falha de um canal não pode interromper a
 * rodada dos outros, e o erro precisa ser gravado para aparecer na tela da
 * pousada em vez de sumir no log do cron.
 */
export async function syncOneFeed(feed: ChannelFeedToImport, deps: SyncDeps): Promise<ChannelSyncResult> {
  let events: ChannelEvent[]
  try {
    events = parseICalendar(await deps.fetchFeed(feed.importUrl))
  } catch (error) {
    // Fail-closed: manda status de erro e NENHUM evento. A RPC da 0044
    // preserva o que já existia em vez de apagar — quarto bloqueado
    // continua bloqueado enquanto a origem estiver fora do ar.
    await deps.apply({ calendarId: feed.calendarId, events: [], status: 'error', error: messageOf(error) })
    return { calendarId: feed.calendarId, status: 'error', events: 0, error: messageOf(error) }
  }

  try {
    await deps.apply({ calendarId: feed.calendarId, events, status: 'ok', error: '' })
    return { calendarId: feed.calendarId, status: 'ok', events: events.length, error: '' }
  } catch (error) {
    return { calendarId: feed.calendarId, status: 'error', events: 0, error: messageOf(error) }
  }
}

/**
 * Sincroniza todos os feeds habilitados, um a um.
 *
 * Sequencial de propósito: a rodada roda a cada 15 minutos e o volume por
 * pousada é pequeno. Paralelizar aqui só multiplicaria o risco de bater em
 * limite de requisição da OTA para ganhar segundos que ninguém está esperando.
 */
export async function syncAllFeeds(deps?: Partial<SyncDeps>): Promise<{
  total: number
  ok: number
  failed: number
  results: ChannelSyncResult[]
}> {
  const resolved: SyncDeps = {
    fetchFeed: deps?.fetchFeed ?? fetchFeedText,
    apply: deps?.apply ?? ((p) => applySyncRpc(p)),
  }
  const feeds = await listFeedsToImport()
  const results: ChannelSyncResult[] = []
  for (const feed of feeds) {
    results.push(await syncOneFeed(feed, resolved))
  }
  return {
    total: results.length,
    ok: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'error').length,
    results,
  }
}
