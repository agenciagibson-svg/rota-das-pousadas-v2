/**
 * "Adicionar à agenda" (h9): arquivo iCalendar (RFC 5545) da reserva.
 *
 * Gerado no servidor (`/minhas-reservas/[id]/agenda.ics`) — aqui fica só a
 * parte pura e testável: escape de texto, dobra de linha e montagem do evento.
 *
 * Com os horários de entrada/saída da pousada (`pousadas.checkin_time` /
 * `checkout_time`, HH:MM no fuso dela) o evento vai das 15:00 do check-in às
 * 11:00 do check-out, em UTC (sem precisar de VTIMEZONE). Sem horário válido,
 * vira evento de dia inteiro do check-in até o dia do check-out (inclusive).
 */
import { DEFAULT_TIMEZONE, addDaysToISODate, isValidTimeZone } from '@/lib/dates'

export type BookingCalendarEvent = {
  bookingId: string
  code: string
  pousadaName: string
  address: string
  cep: string
  city: string
  state: string
  /** AAAA-MM-DD */
  checkin: string
  /** AAAA-MM-DD */
  checkout: string
  /** HH:MM no fuso da pousada; vazio ou inválido = evento de dia inteiro. */
  checkinTime: string
  checkoutTime: string
  timeZone: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  /** Página da reserva no site (aparece na descrição e em URL:). */
  detailsUrl: string
  mapsUrl: string
  /** Domínio do UID (estável entre downloads: a agenda atualiza em vez de duplicar). */
  uidDomain: string
  now: Date
}

const CRLF = '\r\n'
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Escapa um valor TEXT (RFC 5545 §3.3.11): barra invertida, ponto e vírgula,
 * vírgula e quebra de linha (vira `\n` literal).
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Dobra a linha em pedaços de no máximo 75 octetos (RFC 5545 §3.1): a
 * continuação começa com um espaço, que conta nos 75. Conta em bytes UTF-8 e
 * nunca corta um caractere acentuado ao meio.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let size = 0
  let limit = 75
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > limit) {
      out.push(current)
      current = ' '
      size = 1
      limit = 75
    }
    current += char
    size += bytes
  }
  out.push(current)
  return out.join(CRLF)
}

function offsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return Math.round((asUtc - utcMs) / 60_000)
}

/** Data + hora civis no fuso → instante UTC (duas passadas cobrem horário de verão). */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE
  const naive = Date.parse(`${date}T${time}:00Z`)
  let utc = naive - offsetMinutes(naive, zone) * 60_000
  utc = naive - offsetMinutes(utc, zone) * 60_000
  return new Date(utc)
}

function icsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

function icsDate(date: string): string {
  return date.replace(/-/g, '')
}

/** Endereço numa linha: rua, cidade - UF, CEP. */
export function bookingLocation(
  e: Pick<BookingCalendarEvent, 'address' | 'city' | 'state' | 'cep'>,
) {
  const cityState = [e.city, e.state].filter(Boolean).join(' - ')
  return [e.address.trim(), cityState, e.cep ? `CEP ${e.cep}` : ''].filter(Boolean).join(', ')
}

/** Arquivo .ics completo (linhas com CRLF, já dobradas). */
export function buildBookingIcs(e: BookingCalendarEvent): string {
  const timed = TIME_RE.test(e.checkinTime) && TIME_RE.test(e.checkoutTime)
  const when = timed
    ? [
        `DTSTART:${icsUtc(zonedTimeToUtc(e.checkin, e.checkinTime, e.timeZone))}`,
        `DTEND:${icsUtc(zonedTimeToUtc(e.checkout, e.checkoutTime, e.timeZone))}`,
      ]
    : [
        `DTSTART;VALUE=DATE:${icsDate(e.checkin)}`,
        // DTEND de dia inteiro é exclusivo: +1 para o dia da saída aparecer.
        `DTEND;VALUE=DATE:${icsDate(addDaysToISODate(e.checkout, 1))}`,
      ]

  const description = [
    `Código da reserva: ${e.code}`,
    timed ? `Check-in a partir das ${e.checkinTime} · Check-out até as ${e.checkoutTime}` : '',
    `Como chegar: ${e.mapsUrl}`,
    `Sua reserva: ${e.detailsUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rota das Pousadas//Reservas//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:reserva-${e.bookingId}@${e.uidDomain}`,
    `DTSTAMP:${icsUtc(e.now)}`,
    ...when,
    `SUMMARY:${escapeIcsText(`Hospedagem: ${e.pousadaName}`)}`,
    `LOCATION:${escapeIcsText(bookingLocation(e))}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${e.detailsUrl}`,
    `STATUS:${e.status.toUpperCase()}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}

/** Nome do arquivo baixado: só letras, números e hífen. */
export function icsFileName(code: string): string {
  const safe = code.replace(/[^A-Za-z0-9-]/g, '') || 'reserva'
  return `reserva-${safe}.ics`
}
