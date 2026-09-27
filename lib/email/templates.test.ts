import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ publicEnv: { siteUrl: 'https://rotadaspousadas.com.br' } }))

import {
  bookingConfirmedEmail,
  bookingRequestReceivedEmail,
  checkinReminderEmail,
  esc,
  formatDeadline,
  formatStayRange,
} from './templates'
import type { BookingNotificationContext } from '@/repositories/bookings.repository'

const ctx: BookingNotificationContext = {
  bookingId: 'b1',
  code: 'RP-6F4AA5',
  guestName: 'Marcos Menezes',
  guestEmail: 'hospede@example.test',
  checkin: '2026-09-27',
  checkout: '2026-09-29',
  total: 1440,
  currency: 'BRL',
  roomName: 'Acomodação principal',
  status: 'pending',
  adults: 2,
  children: 0,
  paymentDueAt: '2026-09-27T23:42:00.000Z',
  pousada: {
    name: 'Refúgio das Nuvens',
    slug: 'refugio-das-nuvens',
    city: 'Gonçalves',
    state: 'MG',
    timezone: 'America/Sao_Paulo',
    address: 'Estrada da Serra, km 12',
    cep: null,
    checkinTime: '14:00',
    checkoutTime: '12:00',
    contactPhone: '',
    whatsapp: '(34) 99999-0000',
    houseRules: '<script>alert(1)</script> Silêncio após 22h',
    cancellationPolicy: 'Gratuito até 7 dias antes.',
  },
}

describe('e-mails com o visual do site', () => {
  it('pedido recebido mostra prazo no fuso da pousada e dados da reserva', () => {
    const now = new Date('2026-09-27T21:42:00.000Z') // 18:42 em Brasília
    const { subject, html, text } = bookingRequestReceivedEmail(ctx, now)
    expect(subject).toBe('Recebemos seu pedido — Refúgio das Nuvens (RP-6F4AA5)')
    expect(html).toContain('Pague até hoje, 20:42')
    expect(html).toContain('Aguardando pagamento')
    expect(html).toContain('2 adultos · 2 noites')
    expect(html).toContain('dom, 27/09/2026')
    expect(html).toContain('https://rotadaspousadas.com.br/email/logo-compass.png')
    expect(html).toContain('Olá, <strong>Marcos</strong>!')
    expect(text).toContain('Pague até hoje, 20:42')
  })

  it('sem prazo gravado, cai no aviso genérico', () => {
    const { html } = bookingRequestReceivedEmail({ ...ctx, paymentDueAt: null })
    expect(html).not.toContain('Pague até')
    expect(html).toContain('O prazo aparece na sua página de reservas')
  })

  it('confirmada escapa texto digitado pelo dono e mostra endereço com cidade', () => {
    const { html } = bookingConfirmedEmail(ctx)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('Estrada da Serra, km 12 — Gonçalves/MG')
    expect(html).toContain('https://wa.me/5534999990000')
    expect(html).toContain('Confirmada')
  })

  it('lembrete conta os dias até o check-in', () => {
    const { html } = checkinReminderEmail(ctx, new Date('2026-09-25T12:00:00.000Z'))
    expect(html).toContain('Faltam 2 dias')
    expect(html).toContain('check-in em 27 de setembro')
  })

  it('funciona com contexto antigo, sem os campos da 0071', () => {
    const legacy = { ...ctx, adults: undefined, children: undefined, paymentDueAt: undefined }
    expect(() => bookingRequestReceivedEmail(legacy)).not.toThrow()
    expect(bookingRequestReceivedEmail(legacy).html).toContain('2 noites')
  })
})

describe('helpers', () => {
  it('formatDeadline: hoje, amanhã e data', () => {
    const now = new Date('2026-09-27T12:00:00.000Z')
    expect(formatDeadline('2026-09-27T20:00:00.000Z', 'America/Sao_Paulo', now)).toBe('hoje, 17:00')
    expect(formatDeadline('2026-09-28T13:00:00.000Z', 'America/Sao_Paulo', now)).toBe(
      'amanhã, 10:00',
    )
    expect(formatDeadline('2026-09-30T13:00:00.000Z', 'Fuso/Invalido', now)).toBe('30/09, 10:00')
  })
  it('formatStayRange cruza meses', () => {
    expect(formatStayRange('2026-09-27', '2026-09-29')).toBe('27 a 29 de setembro')
    expect(formatStayRange('2026-09-30', '2026-10-02')).toBe('30 de setembro a 2 de outubro')
  })
  it('esc neutraliza HTML', () => {
    expect(esc('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
  })
})
