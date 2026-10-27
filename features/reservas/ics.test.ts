import { describe, expect, it } from 'vitest'
import {
  bookingLocation,
  buildBookingIcs,
  escapeIcsText,
  foldIcsLine,
  icsFileName,
  zonedTimeToUtc,
  type BookingCalendarEvent,
} from './ics'

// Dados sintéticos.
const event: BookingCalendarEvent = {
  bookingId: '11111111-2222-4333-8444-555555555555',
  code: 'RP-ABC123',
  pousadaName: 'Pousada Sol, Mar; e Serra',
  address: 'Rua das Flores, 10',
  cep: '36325-000',
  city: 'Tiradentes',
  state: 'MG',
  checkin: '2026-11-14',
  checkout: '2026-11-17',
  checkinTime: '15:00',
  checkoutTime: '11:00',
  timeZone: 'America/Sao_Paulo',
  status: 'confirmed',
  detailsUrl: 'https://rota.example.test/minhas-reservas',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Pousada',
  uidDomain: 'rota.example.test',
  now: new Date('2026-10-26T12:00:00Z'),
}

/** Desfaz a dobra (CRLF + espaço) para ler as propriedades. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n')
}

function prop(ics: string, name: string): string | undefined {
  return unfold(ics).find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`))
}

describe('escapeIcsText', () => {
  it('escapa vírgula, ponto e vírgula, barra invertida e quebra de linha', () => {
    expect(escapeIcsText('a,b;c\\d\ne\r\nf')).toBe('a\\,b\\;c\\\\d\\ne\\nf')
  })

  it('não mexe em dois-pontos nem acentos', () => {
    expect(escapeIcsText('Ação: 10h')).toBe('Ação: 10h')
  })
})

describe('foldIcsLine', () => {
  const bytes = (s: string) => new TextEncoder().encode(s).length

  it('linha curta fica como está', () => {
    expect(foldIcsLine('SUMMARY:Oi')).toBe('SUMMARY:Oi')
  })

  it('dobra em no máximo 75 octetos, com espaço na continuação', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(2)
    expect(parts.every((p) => bytes(p) <= 75)).toBe(true)
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'x'.repeat(200)}`)
  })

  it('conta bytes UTF-8 e não corta acento ao meio', () => {
    const line = `SUMMARY:${'ç'.repeat(80)}`
    const parts = foldIcsLine(line).split('\r\n')
    expect(parts.every((p) => bytes(p) <= 75)).toBe(true)
    // Cada pedaço é texto UTF-8 válido (nenhum caractere de substituição).
    expect(parts.join('').includes('�')).toBe(false)
    expect(foldIcsLine(line).replace(/\r\n /g, '')).toBe(line)
  })
})

describe('zonedTimeToUtc', () => {
  it('Brasília (UTC-3) vira UTC', () => {
    expect(zonedTimeToUtc('2026-11-14', '15:00', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-11-14T18:00:00.000Z',
    )
  })

  it('fuso inválido cai em Brasília', () => {
    expect(zonedTimeToUtc('2026-11-14', '15:00', 'Brasília').toISOString()).toBe(
      '2026-11-14T18:00:00.000Z',
    )
  })

  it('outro fuso do Brasil (Manaus, UTC-4)', () => {
    expect(zonedTimeToUtc('2026-11-14', '15:00', 'America/Manaus').toISOString()).toBe(
      '2026-11-14T19:00:00.000Z',
    )
  })
})

describe('buildBookingIcs', () => {
  const ics = buildBookingIcs(event)

  it('usa CRLF, abre e fecha o calendário e o evento', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false)
    const lines = unfold(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('BEGIN:VEVENT')
    expect(lines).toContain('END:VEVENT')
    expect(lines.at(-2)).toBe('END:VCALENDAR')
  })

  it('nenhuma linha passa de 75 octetos', () => {
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('com horários da pousada: do check-in ao check-out, em UTC', () => {
    expect(prop(ics, 'DTSTART')).toBe('DTSTART:20261114T180000Z')
    expect(prop(ics, 'DTEND')).toBe('DTEND:20261117T140000Z')
    expect(prop(ics, 'DTSTAMP')).toBe('DTSTAMP:20261026T120000Z')
  })

  it('nome, endereço e código com o texto escapado', () => {
    expect(prop(ics, 'SUMMARY')).toBe('SUMMARY:Hospedagem: Pousada Sol\\, Mar\\; e Serra')
    expect(prop(ics, 'LOCATION')).toBe(
      'LOCATION:Rua das Flores\\, 10\\, Tiradentes - MG\\, CEP 36325-000',
    )
    const description = prop(ics, 'DESCRIPTION') ?? ''
    expect(description).toContain('Código da reserva: RP-ABC123\\n')
    expect(description).toContain('Check-in a partir das 15:00')
    expect(description).toContain(
      'Como chegar: https://www.google.com/maps/search/?api=1&query=Pousada',
    )
  })

  it('UID estável por reserva e status', () => {
    expect(prop(ics, 'UID')).toBe(
      'UID:reserva-11111111-2222-4333-8444-555555555555@rota.example.test',
    )
    expect(prop(ics, 'STATUS')).toBe('STATUS:CONFIRMED')
    expect(prop(buildBookingIcs({ ...event, status: 'tentative' }), 'STATUS')).toBe(
      'STATUS:TENTATIVE',
    )
  })

  it('sem horário válido: dia inteiro, incluindo o dia da saída', () => {
    const allDay = buildBookingIcs({ ...event, checkinTime: '', checkoutTime: '11h' })
    expect(prop(allDay, 'DTSTART')).toBe('DTSTART;VALUE=DATE:20261114')
    expect(prop(allDay, 'DTEND')).toBe('DTEND;VALUE=DATE:20261118')
    expect(prop(allDay, 'DESCRIPTION')).not.toContain('Check-in a partir')
  })
})

describe('auxiliares', () => {
  it('endereço sem CEP nem rua', () => {
    expect(bookingLocation({ address: '', city: 'Tiradentes', state: 'MG', cep: '' })).toBe(
      'Tiradentes - MG',
    )
  })

  it('nome do arquivo só com caracteres seguros', () => {
    expect(icsFileName('RP-ABC123')).toBe('reserva-RP-ABC123.ics')
    expect(icsFileName('../"x"')).toBe('reserva-x.ics')
  })
})
