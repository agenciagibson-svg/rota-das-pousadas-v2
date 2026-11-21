import { publicEnv } from '@/lib/env'
import { formatISODate } from '@/lib/format'
import { offerHref } from '@/features/ofertas/rules'
import type { OfferEmailTarget } from '@/repositories/offers.repository'
import { C, DISPLAY, SANS, emPousada, esc, wrapLayout, type Email } from './templates'

/** Onde o hóspede para de receber ofertas (uma pousada ou todas). */
export const OFFERS_SETTINGS_PATH = '/conta/ofertas'

/**
 * Oferta de uma pousada para quem já se hospedou lá e autorizou (0111). Quem
 * envia é a Rota; o cupom é só desta pessoa. Todo texto da pousada passa por
 * `esc()`.
 */
export function offerEmail(t: OfferEmailTarget): Email {
  const na = emPousada(t.pousadaName)
  const subject = `${t.percent}% de desconto para voltar ${na} ${t.pousadaName}`
  const link = `${publicEnv.siteUrl}${offerHref(t.pousadaSlug, t.code)}`
  const unsubscribe = `${publicEnv.siteUrl}${OFFERS_SETTINGS_PATH}`
  const hello = t.guestName ? `Olá, <strong>${esc(t.guestName)}</strong>!` : 'Olá!'
  const period =
    t.stayFrom && t.stayUntil
      ? `Para estadias entre ${formatISODate(t.stayFrom)} e ${formatISODate(t.stayUntil)}.`
      : t.stayFrom
        ? `Para estadias a partir de ${formatISODate(t.stayFrom)}.`
        : t.stayUntil
          ? `Para estadias até ${formatISODate(t.stayUntil)}.`
          : ''
  const ticket = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};border-radius:18px;">
    <tr><td align="center" style="padding:22px 16px;">
      <p style="margin:0;font:600 12px ${SANS};color:${C.muted};letter-spacing:.06em;text-transform:uppercase;">Seu cupom</p>
      <p style="margin:6px 0 0;font:500 30px ${DISPLAY};color:${C.ink};letter-spacing:.04em;">${esc(t.code)}</p>
      <p style="margin:8px 0 0;font:700 15px ${SANS};color:${C.ink};">${t.percent}% de desconto · válido até ${formatISODate(t.validUntil)}</p>
      ${period ? `<p style="margin:6px 0 0;font:500 13px ${SANS};color:${C.muted};">${esc(period)}</p>` : ''}
      <p style="margin:6px 0 0;font:500 12px ${SANS};color:${C.muted};">Só para você, uso único. Já vai aplicado pelo botão abaixo.</p>
    </td></tr>
  </table>`
  const note = t.message
    ? `<p style="margin:18px 0 0;padding:14px 16px;border-left:3px solid ${C.accent};font:500 14px/1.6 ${SANS};color:${C.ink};">“${esc(t.message)}”<br><span style="color:${C.muted};font-size:12px;">${esc(t.pousadaName)}</span></p>`
    : ''

  const html = wrapLayout({
    preheader: `${t.percent}% de desconto, só para você, até ${formatISODate(t.validUntil)}.`,
    pill: { label: 'Oferta para você', bg: C.accent, fg: C.accentText },
    title: `Volte ${na} ${t.pousadaName}`,
    subtitle: `${t.percent}% de desconto, só para você`,
    intro: `${hello} Como você já se hospedou ${na} <strong>${esc(t.pousadaName)}</strong>, a pousada separou um desconto para a sua próxima visita.`,
    ticketHtml: ticket,
    extraHtml: note,
    cta: { href: esc(link), label: 'Escolher as datas' },
    ctaHint: 'O desconto aparece no resumo da reserva.',
    footerNote: `Você recebeu este e-mail porque autorizou receber ofertas desta pousada depois da sua estadia.<br><a href="${esc(unsubscribe)}" style="color:inherit;">Parar de receber ofertas</a>`,
  })

  const text = [
    `${t.guestName ? `Olá, ${t.guestName}!` : 'Olá!'} Como você já se hospedou ${na} ${t.pousadaName}, a pousada separou ${t.percent}% de desconto para a sua próxima visita.`,
    '',
    `Seu cupom: ${t.code} (só para você, uso único), válido até ${formatISODate(t.validUntil)}.`,
    ...(period ? [period] : []),
    ...(t.message ? ['', `Recado da pousada: ${t.message}`] : []),
    '',
    `Escolher as datas: ${link}`,
    '',
    `Parar de receber ofertas: ${unsubscribe}`,
  ].join('\n')

  return { subject, html, text }
}
