import { publicEnv } from '@/lib/env'
import type { BookingNotificationContext } from '@/repositories/bookings.repository'

/**
 * Templates dos 3 e-mails transacionais do piloto:
 * 1. Pedido recebido (reserva criada, `pending`) — enviado por
 *    `createBooking` (features/reservas/services/bookings.service.ts).
 * 2. Reserva confirmada / "ticket" (pagamento aprovado) — enviado pelo
 *    webhook do Mercado Pago (features/pagamentos/services/webhook.service.ts).
 * 3. Lembrete de check-in (N dias antes) — enviado pelo cron diário
 *    (app/api/cron/expiracao).
 *
 * Os três reaproveitam o mesmo `BookingNotificationContext` (reserva +
 * pousada), sempre linkando de volta pra `/minhas-reservas` em vez de
 * duplicar todo o conteúdo no e-mail — mesma lógica que Airbnb/Booking usam
 * (o e-mail avisa e leva pra "sua página", não substitui o painel).
 */

function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function wrapLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f3ef;font-family:Arial,Helvetica,sans-serif;color:#2b2620;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#b45309;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:bold;">Rota das Pousadas</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="font-size:20px;margin:0 0 16px;color:#2b2620;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f5f3ef;font-size:12px;color:#8a8175;">
                Rota das Pousadas — reserva direto com a pousada, sem intermediário na hospedagem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function infoRow(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;color:#8a8175;font-size:14px;">${label}</td><td style="padding:4px 0;text-align:right;font-weight:bold;font-size:14px;">${value}</td></tr>`
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#b45309;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">${label}</a>`
}

export function bookingRequestReceivedEmail(ctx: BookingNotificationContext): {
  subject: string
  html: string
  text: string
} {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Recebemos seu pedido de reserva — ${ctx.pousada.name} (${ctx.code})`
  const body = `
    <p style="font-size:15px;line-height:1.5;">Olá${ctx.guestName ? `, ${ctx.guestName}` : ''}! Recebemos seu pedido de reserva na <strong>${ctx.pousada.name}</strong>. Para garantir a acomodação, conclua o pagamento — o prazo fica visível na sua página de reservas.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow('Código da reserva', ctx.code)}
      ${infoRow('Acomodação', ctx.roomName)}
      ${infoRow('Check-in', formatDateBR(ctx.checkin))}
      ${infoRow('Check-out', formatDateBR(ctx.checkout))}
      ${infoRow('Total', formatCurrencyBRL(ctx.total))}
    </table>
    ${ctaButton(link, 'Concluir pagamento')}
  `
  const text = `Recebemos seu pedido de reserva na ${ctx.pousada.name}.\nCódigo: ${ctx.code}\nAcomodação: ${ctx.roomName}\nCheck-in: ${formatDateBR(ctx.checkin)}\nCheck-out: ${formatDateBR(ctx.checkout)}\nTotal: ${formatCurrencyBRL(ctx.total)}\n\nConclua o pagamento em: ${link}`
  return { subject, html: wrapLayout('Pedido de reserva recebido', body), text }
}

export function bookingConfirmedEmail(ctx: BookingNotificationContext): {
  subject: string
  html: string
  text: string
} {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Reserva confirmada — ${ctx.pousada.name} (${ctx.code})`
  const contactLines: string[] = []
  if (ctx.pousada.whatsapp) {
    contactLines.push(
      `<p style="font-size:14px;"><a href="https://wa.me/55${onlyDigits(ctx.pousada.whatsapp)}" style="color:#b45309;">Falar no WhatsApp com a pousada</a></p>`,
    )
  } else if (ctx.pousada.contactPhone) {
    contactLines.push(
      `<p style="font-size:14px;color:#8a8175;">Contato da pousada: ${ctx.pousada.contactPhone}</p>`,
    )
  }
  const rulesLines: string[] = []
  if (ctx.pousada.houseRules) {
    rulesLines.push(
      `<p style="font-size:13px;color:#8a8175;"><strong>Regras da casa:</strong> ${ctx.pousada.houseRules}</p>`,
    )
  }
  if (ctx.pousada.cancellationPolicy) {
    rulesLines.push(
      `<p style="font-size:13px;color:#8a8175;"><strong>Cancelamento:</strong> ${ctx.pousada.cancellationPolicy}</p>`,
    )
  }
  const body = `
    <p style="font-size:15px;line-height:1.5;">Sua reserva na <strong>${ctx.pousada.name}</strong> está confirmada — este é o seu comprovante.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow('Código da reserva', ctx.code)}
      ${infoRow('Acomodação', ctx.roomName)}
      ${infoRow('Check-in', `${formatDateBR(ctx.checkin)} a partir das ${ctx.pousada.checkinTime}`)}
      ${infoRow('Check-out', `${formatDateBR(ctx.checkout)} até as ${ctx.pousada.checkoutTime}`)}
      ${infoRow('Total pago', formatCurrencyBRL(ctx.total))}
      ${ctx.pousada.address ? infoRow('Endereço', ctx.pousada.address) : ''}
    </table>
    ${rulesLines.join('')}
    ${contactLines.join('')}
    ${ctaButton(link, 'Ver minha reserva')}
  `
  const text = `Sua reserva na ${ctx.pousada.name} está confirmada.\nCódigo: ${ctx.code}\nAcomodação: ${ctx.roomName}\nCheck-in: ${formatDateBR(ctx.checkin)} (a partir das ${ctx.pousada.checkinTime})\nCheck-out: ${formatDateBR(ctx.checkout)} (até as ${ctx.pousada.checkoutTime})\nTotal pago: ${formatCurrencyBRL(ctx.total)}\n${ctx.pousada.address ? `Endereço: ${ctx.pousada.address}\n` : ''}\nVeja os detalhes em: ${link}`
  return { subject, html: wrapLayout('Reserva confirmada', body), text }
}

export function checkinReminderEmail(ctx: BookingNotificationContext): {
  subject: string
  html: string
  text: string
} {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Sua estadia na ${ctx.pousada.name} está chegando — check-in ${formatDateBR(ctx.checkin)}`
  const body = `
    <p style="font-size:15px;line-height:1.5;">Faltam poucos dias para sua estadia na <strong>${ctx.pousada.name}</strong>!</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow('Código da reserva', ctx.code)}
      ${infoRow('Check-in', `${formatDateBR(ctx.checkin)} a partir das ${ctx.pousada.checkinTime}`)}
      ${ctx.pousada.address ? infoRow('Endereço', ctx.pousada.address) : ''}
    </table>
    ${ctaButton(link, 'Ver detalhes da reserva')}
  `
  const text = `Faltam poucos dias para sua estadia na ${ctx.pousada.name}.\nCódigo: ${ctx.code}\nCheck-in: ${formatDateBR(ctx.checkin)} (a partir das ${ctx.pousada.checkinTime})\n${ctx.pousada.address ? `Endereço: ${ctx.pousada.address}\n` : ''}\nDetalhes em: ${link}`
  return { subject, html: wrapLayout('Sua estadia está chegando', body), text }
}
