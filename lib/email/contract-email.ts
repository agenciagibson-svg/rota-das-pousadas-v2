import { parseContractBody } from '@/features/contrato/contract'
import { C, DISPLAY, SANS, esc, notice, wrapLayout, type Email } from './templates'

/**
 * E-mail "Contrato aceito" (0103): vai para o proprietário que aceitou e,
 * quando configurado, para a caixa da Rota. Leva o texto INTEIRO que ficou
 * guardado, para as duas partes terem a mesma cópia. Mesmo layout dos e-mails
 * de `templates.ts` (tabelas e estilo inline).
 */

const DEFAULT_TZ = 'America/Sao_Paulo'

export function formatAcceptedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: DEFAULT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function factRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font:500 13px ${SANS};color:${C.muted};width:38%;vertical-align:top;">${esc(label)}</td>
    <td style="padding:8px 0;font:600 14px ${SANS};color:${C.ink};word-break:break-word;">${esc(value)}</td>
  </tr>`
}

export function contractAcceptedEmail(p: {
  /** Quem recebe: muda só a frase de abertura. */
  recipient: 'owner' | 'rota'
  pousadaName: string
  acceptedByName: string
  acceptedByEmail: string
  versionTitle: string
  versionCode: string
  acceptedAt: string
  sha256: string
  body: string
  panelUrl: string
}): Email {
  const when = formatAcceptedAt(p.acceptedAt)
  const subject = `Contrato aceito — ${p.pousadaName}`
  const intro =
    p.recipient === 'owner'
      ? `Você aceitou o contrato da <strong>${esc(p.pousadaName)}</strong> com a Rota das Pousadas. Guarde este e-mail: ele traz o texto completo que ficou registrado.`
      : `A <strong>${esc(p.pousadaName)}</strong> aceitou o contrato. Abaixo, o texto completo que ficou registrado.`

  const facts = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};margin:0 0 22px;">
    ${factRow('Contrato', `${p.versionTitle} (versão ${p.versionCode})`)}
    ${factRow('Aceito por', `${p.acceptedByName} (${p.acceptedByEmail})`)}
    ${factRow('Data e hora', `${when} (horário de Brasília)`)}
    ${factRow('Código de conferência', p.sha256)}
  </table>`

  const contract = parseContractBody(p.body)
    .map((block) =>
      block.kind === 'heading'
        ? `<h2 style="margin:22px 0 8px;font:500 18px/1.3 ${DISPLAY};color:${C.ink};">${esc(block.text)}</h2>`
        : `<p style="margin:0 0 12px;font:500 14px/1.65 ${SANS};color:${C.ink};">${esc(block.text)}</p>`,
    )
    .join('\n')

  const html = wrapLayout({
    preheader: `Contrato da ${p.pousadaName} aceito em ${when}.`,
    pill: { label: 'Contrato', bg: '#e2ece6', fg: '#2f6a4f' },
    title: 'Contrato aceito',
    subtitle: `${p.pousadaName} · ${when}`,
    intro,
    ticketHtml: facts,
    extraHtml:
      notice(
        'O código de conferência identifica exatamente este texto. Se uma única letra mudar, o código muda.',
        'ok',
      ) + contract,
    cta: { href: esc(p.panelUrl), label: 'Ver o contrato no painel' },
    ctaHint: 'No painel você também imprime ou salva o contrato em PDF.',
    footerNote:
      'Você recebeu este e-mail porque o contrato desta pousada com a Rota das Pousadas foi aceito em rotadaspousadas.com.br.',
  })

  const text = [
    `Contrato aceito — ${p.pousadaName}`,
    `Contrato: ${p.versionTitle} (versão ${p.versionCode})`,
    `Aceito por: ${p.acceptedByName} (${p.acceptedByEmail})`,
    `Data e hora: ${when} (horário de Brasília)`,
    `Código de conferência: ${p.sha256}`,
    '',
    p.body,
    '',
    `Ver no painel: ${p.panelUrl}`,
  ].join('\n')

  return { subject, html, text }
}
