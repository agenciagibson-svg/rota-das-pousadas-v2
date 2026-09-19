import 'server-only'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
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
/** `redirect: 'manual'` + revalidação a cada salto — evita seguir redirecionamento infinito. */
const MAX_REDIRECTS = 5

export type SyncDeps = {
  fetchFeed: (url: string) => Promise<string>
  apply: (p: {
    calendarId: string
    events: ChannelEvent[]
    status: 'ok' | 'error'
    error: string
  }) => Promise<unknown>
}

/**
 * IPs privados/reservados/loopback/link-local — inclui o range de metadados
 * de nuvem (169.254.169.254, AWS/GCP/Azure) e o range de link-local IPv6
 * (fe80::/10, onde vive o equivalente de metadados em alguns provedores).
 * `BlockList` (node:net) faz o teste de CIDR nativamente, sem dependência.
 */
function buildPrivateBlockList(): BlockList {
  const list = new BlockList()
  const v4: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10], // CGNAT
    ['127.0.0.0', 8],
    ['169.254.0.0', 16], // link-local — inclui metadados de nuvem (169.254.169.254)
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 4], // multicast
    ['240.0.0.0', 4], // reservado
  ]
  const v6: Array<[string, number]> = [
    ['::1', 128],
    ['::ffff:0:0', 96], // IPv4-mapped — o IPv4 embutido é checado à parte
    ['64:ff9b::', 96], // NAT64
    ['fc00::', 7], // unique local
    ['fe80::', 10], // link-local
  ]
  for (const [address, prefix] of v4) list.addSubnet(address, prefix, 'ipv4')
  for (const [address, prefix] of v6) list.addSubnet(address, prefix, 'ipv6')
  return list
}
const PRIVATE_BLOCKLIST = buildPrivateBlockList()

/**
 * Guarda contra SSRF: recusa buscar um feed cujo host resolva para um IP
 * privado/loopback/link-local. Aplicada de novo a CADA redirecionamento
 * (não só na URL original) — sem isso, um feed hospedado num IP público
 * poderia redirecionar para `http://169.254.169.254/...` ou `localhost` e o
 * `fetch` seguiria sem checagem nenhuma.
 *
 * Limitação conhecida: a checagem resolve o DNS e SÓ DEPOIS chama `fetch`,
 * que resolve de novo — uma janela pequena para "DNS rebinding" (o domínio
 * responde um IP público na checagem e um privado no fetch de verdade)
 * continua existindo. Fechar isso por completo exige fixar o IP resolvido
 * na conexão (dispatcher/agent customizado), fora do escopo desta correção;
 * o que está aqui já bloqueia o ataque comum (URL apontando direto para IP
 * privado, ou redirecionamento para um).
 */
async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('URL do calendário inválida.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL do calendário deve ser http ou https.')
  }
  const hostname = parsed.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Endereço do calendário não é permitido.')
  }

  const literalFamily = isIP(hostname)
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true })

  if (addresses.length === 0) {
    throw new Error('Não foi possível resolver o endereço do calendário.')
  }
  for (const { address, family } of addresses) {
    if (PRIVATE_BLOCKLIST.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new Error('Endereço do calendário não é permitido.')
    }
  }
  return parsed
}

/** Busca o texto de um feed com timeout, teto de tamanho e bloqueio de SSRF. */
export async function fetchFeedText(url: string): Promise<string> {
  let currentUrl = url
  for (let redirectCount = 0; ; redirectCount++) {
    if (redirectCount > MAX_REDIRECTS)
      throw new Error('Muitos redirecionamentos ao buscar o calendário.')

    const parsed = await assertPublicHttpUrl(currentUrl)

    const response = await fetch(parsed, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      cache: 'no-store',
      redirect: 'manual',
      headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1' },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('O canal respondeu com redirecionamento sem destino.')
      currentUrl = new URL(location, parsed).toString()
      continue
    }

    if (!response.ok) throw new Error(`O canal respondeu ${response.status}.`)

    const length = Number(response.headers.get('content-length') ?? '0')
    if (Number.isFinite(length) && length > MAX_FEED_BYTES) {
      throw new Error('Calendário grande demais para ser processado.')
    }
    const text = await response.text()
    if (text.length > MAX_FEED_BYTES)
      throw new Error('Calendário grande demais para ser processado.')
    return text
  }
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
export async function syncOneFeed(
  feed: ChannelFeedToImport,
  deps: SyncDeps,
): Promise<ChannelSyncResult> {
  let events: ChannelEvent[]
  try {
    events = parseICalendar(await deps.fetchFeed(feed.importUrl))
  } catch (error) {
    // Fail-closed: manda status de erro e NENHUM evento. A RPC da 0044
    // preserva o que já existia em vez de apagar — quarto bloqueado
    // continua bloqueado enquanto a origem estiver fora do ar.
    await deps.apply({
      calendarId: feed.calendarId,
      events: [],
      status: 'error',
      error: messageOf(error),
    })
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
