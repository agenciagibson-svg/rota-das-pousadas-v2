import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildICalendar,
  escapeText,
  foldLine,
  parseICalDate,
  parseICalendar,
  unescapeText,
  unfold,
} from './ical'

/** Amostra no formato que o Airbnb publica, com DESCRIPTION dobrada em duas linhas. */
const FEED_AIRBNB = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN',
  'CALSCALE:GREGORIAN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261005',
  'DTSTART;VALUE=DATE:20261001',
  'UID:1a2b3c4d-0000@airbnb.com',
  'SUMMARY:Reserved',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de',
  ' tails/HMABCDEFG\\nPhone Number (Last 4 Digits): 1234',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261112',
  'DTSTART;VALUE=DATE:20261110',
  'UID:9f8e7d6c-0000@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

/** Amostra no formato do Booking.com. */
const FEED_BOOKING = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Booking.com B.V.//NONSGML Calendar//EN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261010',
  'DTEND;VALUE=DATE:20261012',
  'SUMMARY:CLOSED - Not available',
  'UID:1234567890abcdef',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('unfold', () => {
  it('junta linha dobrada com espaço e com tab', () => {
    expect(unfold('DESCRIPTION:abc\r\n def')).toBe('DESCRIPTION:abcdef')
    expect(unfold('DESCRIPTION:abc\n\tdef')).toBe('DESCRIPTION:abcdef')
  })
  it('não junta linha seguinte que não começa com espaço', () => {
    expect(unfold('SUMMARY:a\r\nUID:b')).toBe('SUMMARY:a\r\nUID:b')
  })
})

describe('parseICalDate', () => {
  it('aceita data pura e data com hora', () => {
    expect(parseICalDate('20261001')).toBe('2026-10-01')
    expect(parseICalDate('20261001T150000Z')).toBe('2026-10-01')
    expect(parseICalDate('20261001T150000')).toBe('2026-10-01')
  })
  it('recusa data impossível e lixo', () => {
    expect(parseICalDate('20261301')).toBeNull()
    expect(parseICalDate('20260230')).toBeNull()
    expect(parseICalDate('nao-e-data')).toBeNull()
  })
})

describe('parseICalendar — feed do Airbnb', () => {
  const events = parseICalendar(FEED_AIRBNB)

  it('lê os dois eventos com período exclusivo no fim', () => {
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      uid: '1a2b3c4d-0000@airbnb.com',
      startsOn: '2026-10-01',
      endsOn: '2026-10-05',
      summary: 'Reserved',
    })
    expect(events[1].startsOn).toBe('2026-11-10')
  })

  it('não confunde linha dobrada da DESCRIPTION com propriedade', () => {
    // A continuação contém "tails/..." — um parser sem unfold criaria lixo
    // ou, pior, leria uma data de dentro da descrição.
    expect(events.map((e) => e.uid)).toEqual([
      '1a2b3c4d-0000@airbnb.com',
      '9f8e7d6c-0000@airbnb.com',
    ])
  })
})

describe('parseICalendar — feed do Booking', () => {
  it('lê o bloqueio mesmo com as propriedades em outra ordem', () => {
    const events = parseICalendar(FEED_BOOKING)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      uid: '1234567890abcdef',
      startsOn: '2026-10-10',
      endsOn: '2026-10-12',
      summary: 'CLOSED - Not available',
    })
  })
})

describe('parseICalendar — casos de borda', () => {
  function feed(...eventLines: string[]) {
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...eventLines, 'END:VCALENDAR'].join('\r\n')
  }

  it('lança quando a resposta não é um calendário', () => {
    expect(() => parseICalendar('<html>404</html>')).toThrow(/iCal/)
    expect(() => parseICalendar('')).toThrow()
  })

  it('DTEND ausente vira uma diária', () => {
    const events = parseICalendar(feed('BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261001', 'UID:x', 'END:VEVENT'))
    expect(events[0]).toMatchObject({ startsOn: '2026-10-01', endsOn: '2026-10-02' })
  })

  it('descarta evento com fim igual ou anterior ao início', () => {
    const events = parseICalendar(
      feed(
        'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261001', 'UID:a', 'END:VEVENT',
        'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261010', 'DTEND;VALUE=DATE:20261005', 'UID:b', 'END:VEVENT',
      ),
    )
    expect(events).toHaveLength(0)
  })

  it('evento sem UID recebe um identificador estável pelo período', () => {
    const first = parseICalendar(feed('BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261003', 'END:VEVENT'))
    const second = parseICalendar(feed('BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261003', 'END:VEVENT'))
    expect(first[0].uid).toBe(second[0].uid)
    expect(first[0].uid).toContain('2026-10-01')
  })

  it('uma linha ruim não descarta o feed inteiro', () => {
    const events = parseICalendar(
      feed(
        'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:invalido', 'UID:ruim', 'END:VEVENT',
        'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261001', 'DTEND;VALUE=DATE:20261003', 'UID:bom', 'END:VEVENT',
      ),
    )
    expect(events.map((e) => e.uid)).toEqual(['bom'])
  })

  it('aceita feed com quebra de linha só LF', () => {
    expect(parseICalendar(FEED_BOOKING.replace(/\r\n/g, '\n'))).toHaveLength(1)
  })

  it('desfaz escape de texto na SUMMARY', () => {
    const events = parseICalendar(feed('BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261001', 'UID:x', 'SUMMARY:Casal\\, 2 noites', 'END:VEVENT'))
    expect(events[0].summary).toBe('Casal, 2 noites')
  })
})

describe('escape e unescape', () => {
  it('fazem a volta completa', () => {
    const original = 'Reserva; com, vírgula\\barra\nlinha'
    expect(unescapeText(escapeText(original))).toBe(original)
  })
})

describe('foldLine', () => {
  it('não mexe em linha curta', () => {
    expect(foldLine('SUMMARY:Reservado')).toBe('SUMMARY:Reservado')
  })
  it('dobra por octeto e nunca no meio de um caractere acentuado', () => {
    const folded = foldLine('SUMMARY:' + 'Indisponível '.repeat(12))
    const encoder = new TextEncoder()
    for (const part of folded.split('\r\n')) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(76)
    }
    // Nenhum caractere de substituição: os acentos sobreviveram inteiros.
    expect(folded).not.toContain('�')
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'Indisponível '.repeat(12))
  })
})

describe('buildICalendar', () => {
  const NOW = new Date('2026-09-13T18:00:00Z')
  const feed = buildICalendar({
    roomName: 'Chalé Vale',
    now: NOW,
    events: [
      { uid: 'booking-1', startsOn: '2027-01-10', endsOn: '2027-01-14', summary: 'Reservado' },
      { uid: 'block-1', startsOn: '2027-02-01', endsOn: '2027-02-04', summary: 'Indisponível' },
    ],
  })

  it('gera um calendário válido com CRLF', () => {
    expect(feed.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(feed.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(feed.split('BEGIN:VEVENT')).toHaveLength(3)
  })

  it('usa datas de dia inteiro no formato do RFC', () => {
    expect(feed).toContain('DTSTART;VALUE=DATE:20270110')
    expect(feed).toContain('DTEND;VALUE=DATE:20270114')
    expect(feed).toContain(`DTSTAMP:20260913T180000Z`)
  })

  it('não vaza nenhum dado de hóspede', () => {
    // O Airbnb põe nome, link da reserva e final do telefone na DESCRIPTION.
    // O nosso feed não tem DESCRIPTION alguma.
    expect(feed).not.toMatch(/DESCRIPTION/i)
    // O único "@" aceitável é o sufixo de domínio do UID, que o RFC 5545 pede.
    // Em qualquer outra linha, "@" seria e-mail de hóspede vazando.
    const arrobaForaDoUid = feed
      .split('\r\n')
      .filter((linha) => !linha.startsWith('UID:') && linha.includes('@'))
    expect(arrobaForaDoUid).toEqual([])
    expect(feed).not.toMatch(/\d{2,3}\)?\s?9?\d{4}-?\d{4}/) // nenhum telefone
    expect(feed).not.toMatch(/R\$/) // nenhum valor
  })

  it('descarta evento com período inválido em vez de gerar feed quebrado', () => {
    const ruim = buildICalendar({
      roomName: 'Quarto',
      now: NOW,
      events: [{ uid: 'a', startsOn: '2027-01-10', endsOn: '2027-01-10', summary: 'x' }],
    })
    expect(ruim).not.toContain('BEGIN:VEVENT')
  })

  it('o que geramos é lido de volta pelo nosso próprio parser', () => {
    const roundTrip = parseICalendar(feed)
    expect(roundTrip).toHaveLength(2)
    expect(roundTrip[0]).toMatchObject({ startsOn: '2027-01-10', endsOn: '2027-01-14', summary: 'Reservado' })
    expect(roundTrip[1].summary).toBe('Indisponível')
  })
})

describe('addDays', () => {
  it('atravessa mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})
