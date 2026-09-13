/**
 * iCalendar (RFC 5545) — leitura dos feeds das OTAs e geração do nosso.
 *
 * Puro e determinístico, sem rede e sem banco: o que chega é texto, o que sai é
 * um período. Toda a parte frágil desta feature mora aqui, então é aqui que
 * moram os testes — `ical.test.ts` usa amostras no formato real do Airbnb e do
 * Booking, com dobra de linha e acento.
 *
 * CONVENÇÃO DE DATA: `endsOn` é EXCLUSIVO, como `bookings.checkout` e como o
 * `DTEND` de um evento de dia inteiro no RFC. Um bloqueio de 14 a 16 ocupa as
 * noites 14 e 15 e libera o dia 16. Não há conversão de mais-ou-menos-um em
 * nenhum ponto do caminho — é a mesma semântica do começo ao fim.
 *
 * FUSO: feeds de OTA usam `VALUE=DATE` (dia inteiro, sem hora e sem fuso).
 * Quando vem com hora, ficamos com a parte da data e ignoramos o horário: a
 * unidade de venda de uma pousada é a diária, não o instante, e converter fuso
 * aqui só criaria a chance de deslocar um bloqueio em um dia.
 */

/** Evento de canal já normalizado para o formato que o banco espera. */
export type ChannelEvent = {
  uid: string
  startsOn: string
  endsOn: string
  summary: string
}

const DAY_MS = 86_400_000

function isoToUTC(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime()
}

function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return toISODate(isoToUTC(iso) + days * DAY_MS)
}

/**
 * Desfaz a dobra de linha do RFC 5545: linhas longas são quebradas com CRLF
 * seguido de um espaço ou tab. Precisa acontecer ANTES de qualquer leitura de
 * propriedade — sem isso, uma DESCRIPTION dobrada vira uma "propriedade"
 * inventada, e é assim que parser ingênuo lê data errada.
 */
export function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/\r[ \t]/g, '')
}

/** Reverte o escape de texto do RFC 5545 (\\n, \\, \; \,). */
export function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** Aplica o escape exigido pelo RFC 5545 em valores de texto. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Extrai a data de um valor de DTSTART/DTEND.
 * Aceita `20261001`, `20261001T150000Z` e `20261001T150000`; devolve null para
 * qualquer outra coisa, inclusive data impossível como `20261301`.
 */
export function parseICalDate(raw: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim())
  if (!match) return null
  const [, y, m, d] = match
  const iso = `${y}-${m}-${d}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null
  return iso
}

type RawProperty = { name: string; value: string }

function parseProperty(line: string): RawProperty | null {
  // NOME;PARAM=VALOR:valor — o primeiro ":" fora de aspas separa nome de valor.
  const colon = line.indexOf(':')
  if (colon <= 0) return null
  const left = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const name = left.split(';')[0].trim().toUpperCase()
  if (!name) return null
  return { name, value }
}

/**
 * Lê um feed iCalendar e devolve os períodos ocupados.
 *
 * Eventos sem data utilizável, ou com fim anterior ou igual ao início, são
 * descartados em silêncio — um feed com uma linha ruim continua sendo aplicado
 * no resto. O que NÃO acontece é o chamador receber lista vazia por causa de um
 * erro de formato: para isso existe `parseICalendar` lançar em texto que nem
 * VCALENDAR é, e o serviço tratar como falha de sincronização (fail-closed).
 */
export function parseICalendar(text: string): ChannelEvent[] {
  if (typeof text !== 'string' || !/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error('Resposta não é um calendário iCal válido.')
  }
  const lines = unfold(text).split(/\r\n|\n|\r/)
  const events: ChannelEvent[] = []

  let current: { uid?: string; start?: string; end?: string; summary?: string } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^BEGIN:VEVENT$/i.test(trimmed)) {
      current = {}
      continue
    }
    if (/^END:VEVENT$/i.test(trimmed)) {
      if (current?.start) {
        // DTEND ausente em evento de dia inteiro significa uma diária (RFC 5545).
        const end = current.end ?? addDays(current.start, 1)
        if (isoToUTC(end) > isoToUTC(current.start)) {
          events.push({
            // Sem UID, deriva um estável a partir do período: mantém a
            // idempotência entre sincronizações em vez de descartar um
            // bloqueio real por causa de um feed incompleto.
            uid: current.uid || `derivado-${current.start}-${end}`,
            startsOn: current.start,
            endsOn: end,
            summary: current.summary ?? '',
          })
        }
      }
      current = null
      continue
    }
    if (!current) continue

    const prop = parseProperty(trimmed)
    if (!prop) continue
    if (prop.name === 'UID') current.uid = prop.value.trim().slice(0, 400)
    else if (prop.name === 'DTSTART') current.start = parseICalDate(prop.value) ?? current.start
    else if (prop.name === 'DTEND') current.end = parseICalDate(prop.value) ?? current.end
    else if (prop.name === 'SUMMARY') current.summary = unescapeText(prop.value).trim().slice(0, 200)
  }

  return events
}

/**
 * Dobra uma linha em 75 OCTETOS, não em 75 caracteres.
 *
 * "Indisponível" ocupa 13 bytes em UTF-8 e 12 caracteres. Dobrar por caractere
 * gera linha longa demais para leitores rígidos; dobrar no meio de um caractere
 * multibyte corrompe o acento. Por isso a conta é feita em bytes e o corte só
 * acontece em fronteira de caractere.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let chunk = ''
  let bytes = 0
  let limit = 75
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > limit) {
      parts.push(chunk)
      chunk = char
      bytes = size
      limit = 74 // continuação começa com um espaço, que também conta
    } else {
      chunk += char
      bytes += size
    }
  }
  if (chunk) parts.push(chunk)
  return parts.join('\r\n ')
}

function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

/**
 * Gera o feed que a Rota publica para a OTA ler.
 *
 * O conteúdo é deliberadamente pobre: período e rótulo genérico. Nome, telefone,
 * e-mail, documento e valor do hóspede NUNCA entram aqui — a URL do feed é um
 * segredo fraco, colada na extranet da OTA e acessada sem sessão.
 */
export function buildICalendar(params: {
  roomName: string
  events: ChannelEvent[]
  now?: Date
}): string {
  const now = params.now ?? new Date()
  const dtstamp = stamp(now)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rota das Pousadas//Calendario de Canais//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(params.roomName)}`,
  ]

  for (const event of params.events) {
    if (!parseICalDate(event.startsOn.replace(/-/g, '')) || !parseICalDate(event.endsOn.replace(/-/g, ''))) continue
    if (isoToUTC(event.endsOn) <= isoToUTC(event.startsOn)) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@rotadaspousadas.com.br`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${event.startsOn.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${event.endsOn.replace(/-/g, '')}`,
      `SUMMARY:${escapeText(event.summary || 'Reservado')}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
