import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ publicEnv: { siteUrl: 'https://rotadaspousadas.com.br' } }))

import {
  bookingConfirmedEmail,
  bookingRequestReceivedEmail,
  checkinReminderEmail,
  emPousada,
  esc,
  formatDeadline,
  formatStayRange,
  passwordChangedEmail,
  paymentProofAlertEmail,
  paymentProofReceivedEmail,
  paymentProofRejectedEmail,
  passwordResetEmail,
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

describe('emPousada', () => {
  it('usa "no" para nomes masculinos e "na" para o resto', () => {
    expect(emPousada('Refúgio das Nuvens')).toBe('no')
    expect(emPousada('Vale Esmeralda Boutique')).toBe('no')
    expect(emPousada('Pousada Sol')).toBe('na')
    expect(emPousada('Casa da Serra')).toBe('na')
  })
  it('o e-mail de confirmação diz "no Refúgio"', () => {
    const { html } = bookingConfirmedEmail(ctx)
    expect(html).toContain('no <strong>Refúgio das Nuvens</strong>')
  })
})

describe('e-mails de senha', () => {
  it('link de nova senha traz botão, endereço de fallback e o e-mail da conta', () => {
    const link = 'https://rotadaspousadas.com.br/redefinir-senha?token=abc123'
    const { subject, html, text } = passwordResetEmail({
      name: 'Ana Souza',
      email: 'ana@ex.com',
      link,
    })
    expect(subject).toContain('nova senha')
    expect(html).toContain('Olá, <strong>Ana</strong>!')
    expect(html).toContain('Criar nova senha')
    expect(html.split(link).length - 1).toBeGreaterThanOrEqual(2)
    expect(html).toContain('ana@ex.com')
    expect(html).not.toContain('porque fez uma reserva')
    expect(text).toContain(link)
  })
  it('escapa nome vindo do cadastro', () => {
    const { html } = passwordResetEmail({ name: '<b>x</b>', email: 'a@b.co', link: 'https://x.co' })
    expect(html).not.toContain('<b>x</b>')
  })
  it('aviso de senha alterada mostra data e caminho para recuperar', () => {
    const { html } = passwordChangedEmail({
      name: null,
      loginUrl: 'https://rotadaspousadas.com.br/login',
      resetUrl: 'https://rotadaspousadas.com.br/esqueci-senha',
      now: new Date('2026-09-27T18:30:00Z'),
    })
    expect(html).toContain('27/09/2026')
    expect(html).toContain('15:30')
    expect(html).toContain('/esqueci-senha')
  })
})

describe('e-mails do Pix direto', () => {
  it('hóspede: comprovante recebido, datas guardadas', () => {
    const { subject, html } = paymentProofReceivedEmail(ctx, 1440)
    expect(subject).toContain('Comprovante recebido')
    expect(html).toContain('R$')
    expect(html).toContain('datas continuam guardadas')
  })
  it('pousada: link direto para a reserva no painel', () => {
    const { subject, html } = paymentProofAlertEmail(ctx, 1440)
    expect(subject).toContain(ctx.code)
    expect(html).toContain(`/dashboard/reservas/${ctx.bookingId}`)
    expect(html).toContain('equipe desta pousada')
  })
  it('hóspede: recusa com motivo escapado', () => {
    const { html } = paymentProofRejectedEmail(ctx, 'Valor <b>diferente</b>')
    expect(html).toContain('Valor &lt;b&gt;diferente&lt;/b&gt;')
  })
})

describe('memberInviteEmail', () => {
  it('explica o caminho com e sem conta e escapa o nome', async () => {
    const { memberInviteEmail } = await import('./templates')
    const mail = memberInviteEmail({
      pousadaName: 'Pousada <Teste>',
      roleLabel: 'Recepção',
      inviterName: 'Marcos',
      email: 'a@b.com',
      dashboardUrl: 'https://rotadaspousadas.com.br/dashboard',
      signupUrl: 'https://rotadaspousadas.com.br/cadastro',
    })
    expect(mail.subject).toContain('Pousada <Teste>')
    expect(mail.html).toContain('Pousada &lt;Teste&gt;')
    expect(mail.html).not.toContain('<Teste>')
    expect(mail.text).toContain('/cadastro')
    expect(mail.text).toContain('/dashboard')
  })
})
