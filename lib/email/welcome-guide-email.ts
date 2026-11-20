import {
  LINKS_GUIDE_STEPS,
  LINKS_GUIDE_TIP,
  linkFor,
  type TrackedLinks,
} from '@/features/origem/guide'
import { C, SANS, esc, notice, wrapLayout, type Email } from './templates'

/**
 * Boas-vindas à pousada publicada (0107): o passo a passo para colocar os
 * links com a origem marcada no Google, no Instagram e no WhatsApp, já com os
 * links DELA no corpo do e-mail. Mesmo texto do painel (features/origem/guide.ts).
 */
export function welcomeGuideEmail(p: {
  pousadaName: string
  ownerName: string | null
  links: TrackedLinks
  panelUrl: string
  pageUrl: string
}): Email {
  const subject = `${p.pousadaName} está no ar: coloque o link da Rota no Google e no Instagram`
  const hello = p.ownerName ? `Olá, ${esc(p.ownerName.split(' ')[0]!)}!` : 'Olá!'

  const steps = LINKS_GUIDE_STEPS.map((step, i) => {
    const link = linkFor(p.links, step.id)
    const items = step.items
      .map(
        (item) =>
          `<li style="margin:0 0 6px;font:500 14px/1.55 ${SANS};color:${C.ink};">${esc(item)}</li>`,
      )
      .join('')
    const note = step.note
      ? `<p style="margin:10px 0 0;padding:12px 14px;background:${C.linen};border-radius:12px;font:500 13px/1.55 ${SANS};color:${C.muted};">${esc(step.note)}</p>`
      : ''
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};margin:0;">
      <tr><td style="padding:18px 0;">
        <p style="margin:0 0 8px;font:700 16px ${SANS};color:${C.ink};">${i + 1}. ${esc(step.title)}</p>
        <p style="margin:0 0 10px;font:500 13px ${SANS};color:${C.muted};">Seu link:</p>
        <p style="margin:0 0 12px;padding:10px 12px;background:${C.linen};border-radius:10px;font:600 13px/1.4 ${SANS};word-break:break-all;"><a href="${esc(link)}" style="color:${C.forest};">${esc(link)}</a></p>
        <ol style="margin:0;padding-left:20px;">${items}</ol>
        ${note}
      </td></tr>
    </table>`
  }).join('')

  const html = wrapLayout({
    preheader: `Seus 3 links e o passo a passo para receber mais reservas diretas.`,
    pill: { label: 'Pousada no ar', bg: C.accent, fg: C.accentText },
    title: 'Sua pousada está no ar',
    subtitle: p.pousadaName,
    intro: `${hello} A <strong>${esc(p.pousadaName)}</strong> já aparece na Rota das Pousadas: <a href="${esc(p.pageUrl)}" style="color:${C.forest};font-weight:700;">${esc(p.pageUrl)}</a>.<br><br>Para receber mais reservas diretas, coloque o link da Rota nos lugares onde o hóspede já procura a sua pousada. Leva uns 10 minutos. Cada link abaixo mostra, em cada reserva, de onde o hóspede veio — você acompanha no painel qual canal traz mais reserva.`,
    ticketHtml: steps,
    extraHtml: notice(`<strong>Dica:</strong> ${esc(LINKS_GUIDE_TIP)}`, 'ok'),
    cta: { href: esc(p.panelUrl), label: 'Abrir meus links no painel' },
    ctaHint: 'Os links e este passo a passo também ficam em Painel → Link da bio.',
    footerNote:
      'Você recebeu este e-mail porque é proprietário de uma pousada publicada na Rota das Pousadas.',
  })

  const text = [
    `${p.ownerName ? `Olá, ${p.ownerName.split(' ')[0]}!` : 'Olá!'} A ${p.pousadaName} já está no ar na Rota das Pousadas: ${p.pageUrl}`,
    '',
    'Para receber mais reservas diretas, coloque estes links (uns 10 minutos):',
    '',
    ...LINKS_GUIDE_STEPS.flatMap((step, i) => [
      `${i + 1}. ${step.title}`,
      `Seu link: ${linkFor(p.links, step.id)}`,
      ...step.items.map((item) => `- ${item}`),
      ...(step.note ? [step.note] : []),
      '',
    ]),
    `Dica: ${LINKS_GUIDE_TIP}`,
    '',
    `Os links e o passo a passo também ficam no painel: ${p.panelUrl}`,
  ].join('\n')

  return { subject, html, text }
}
