import { publicEnv } from '@/lib/env'
import {
  monthLabel,
  monthName,
  type MonthlyReport,
  type Variation,
} from '@/features/dashboard/monthly-report'
import {
  C,
  DISPLAY,
  SANS,
  emPousada,
  esc,
  formatCurrencyBRL,
  notice,
  wrapLayout,
  type Email,
} from './templates'

/**
 * E-mail "Relatório do mês" (0097) para proprietário e gestor — mesmo layout
 * dos e-mails de `templates.ts` (tabelas e estilo inline, que é o que Gmail e
 * Outlook respeitam). Os números chegam prontos de
 * `features/dashboard/monthly-report.ts`; aqui só há formatação.
 */

const VARIATION_STYLE: Record<Variation['direction'], { bg: string; fg: string; arrow: string }> = {
  up: { bg: '#eaf0ed', fg: '#1d5c3f', arrow: '&#9650; ' },
  down: { bg: '#f6e0db', fg: '#b3412a', arrow: '&#9660; ' },
  same: { bg: C.linen, fg: C.muted, arrow: '' },
  new: { bg: C.linen, fg: C.muted, arrow: '' },
}

const TEXT_ARROW: Record<Variation['direction'], string> = {
  up: '↑ ',
  down: '↓ ',
  same: '',
  new: '',
}

function variationChip(v: Variation): string {
  const s = VARIATION_STYLE[v.direction]
  return `<span style="display:inline-block;background:${s.bg};color:${s.fg};font:600 12px ${SANS};padding:3px 9px;border-radius:999px;white-space:nowrap;">${s.arrow}${esc(v.label)}</span>`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

type Kpi = { label: string; value: string; variation: Variation }

function kpis(r: MonthlyReport): Kpi[] {
  const c = r.current
  return [
    { label: 'Ocupação', value: `${c.occupancyRate}%`, variation: r.variations.occupancy },
    { label: 'Receita', value: formatCurrencyBRL(c.revenue), variation: r.variations.revenue },
    {
      label: 'Diária média',
      value: c.nights > 0 ? formatCurrencyBRL(c.averageDailyRate) : '—',
      variation: r.variations.averageDailyRate,
    },
    { label: 'Reservas', value: String(c.bookings), variation: r.variations.bookings },
    { label: 'Noites vendidas', value: String(c.nights), variation: r.variations.nights },
  ]
}

function kpiTable(r: MonthlyReport): string {
  const list = kpis(r)
  const rows = list
    .map((k, i) => {
      const bb = i === list.length - 1 ? '' : `border-bottom:1px solid ${C.border};`
      return `<tr>
  <td style="padding:12px 0;${bb}font:500 13px ${SANS};color:${C.muted};">${esc(k.label)}</td>
  <td align="right" style="padding:12px 0 12px 12px;${bb}font:700 17px ${SANS};color:${C.ink};white-space:nowrap;">${esc(k.value)}</td>
  <td align="right" width="110" style="padding:12px 0 12px 12px;${bb}">${variationChip(k.variation)}</td>
</tr>`
    })
    .join('')
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};border:1px solid ${C.border};border-radius:16px;">
  <tr><td style="padding:18px 22px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:600 12px ${SANS};color:${C.muted};">${esc(capitalize(monthLabel(r.current.month)))}</td>
      <td align="right" style="font:600 12px ${SANS};color:${C.muted};">comparado com ${esc(monthName(r.previous.month))}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 22px 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
</table>`
}

function originsBlock(r: MonthlyReport): string {
  if (r.current.origins.length === 0) return ''
  const rows = r.current.origins
    .map((o, i) => {
      const bb = i === r.current.origins.length - 1 ? '' : `border-bottom:1px solid ${C.border};`
      return `<tr>
  <td style="padding:10px 0;${bb}font:600 14px ${SANS};color:${C.ink};">${esc(o.label)}</td>
  <td align="right" style="padding:10px 0 10px 12px;${bb}font:500 13px ${SANS};color:${C.muted};white-space:nowrap;">${esc(plural(o.bookings, 'reserva', 'reservas'))} · ${esc(formatCurrencyBRL(o.revenue))}</td>
</tr>`
    })
    .join('')
  return `
<h2 style="margin:26px 0 8px;font:500 19px ${DISPLAY};color:${C.ink};">De onde vieram as reservas</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

function howWeCount(r: MonthlyReport): string {
  const rooms = plural(r.current.totalRooms, 'quarto ativo', 'quartos ativos')
  return `<p style="margin:22px 0 0;font:500 12px/1.6 ${SANS};color:${C.muted};">Como contamos: são os mesmos números do seu painel. Receita, reservas e noites são das estadias com entrada no mês (pendentes, confirmadas e concluídas; canceladas ficam de fora). Ocupação = noites ocupadas no mês ÷ noites disponíveis dos ${esc(rooms)}. Diária média = receita ÷ noites vendidas.</p>`
}

const PREVIEW_NOTICE = notice(
  '<strong>Prévia.</strong> Enviada só para você pelo painel da Rota. Nada foi marcado como enviado e a pousada não recebeu este e-mail.',
  'warn',
)

export function monthlyReportEmail(report: MonthlyReport, opts: { preview?: boolean } = {}): Email {
  const link = `${publicEnv.siteUrl}/dashboard`
  const name = report.pousadaName
  const label = monthLabel(report.current.month)
  const month = monthName(report.current.month)
  const prefix = opts.preview ? '[Prévia] ' : ''
  const subject = `${prefix}Resumo de ${label} — ${name}`
  const footerNote = opts.preview
    ? 'Prévia do relatório mensal enviada pelo painel da Rota das Pousadas.'
    : 'Você recebeu este resumo porque é proprietário ou gestor desta pousada na Rota das Pousadas. Ele chega todo dia 1º com os números do mês anterior.'

  if (!report.hasActivity) {
    const html = wrapLayout({
      preheader: `Nenhuma reserva registrada em ${label}.`,
      pill: {
        label: opts.preview ? 'Prévia do relatório' : 'Relatório do mês',
        bg: C.accent,
        fg: C.accentText,
      },
      title: `${capitalize(month)} sem reservas`,
      subtitle: `${name} · ${label}`,
      intro: `Olá! Não houve reservas com entrada em ${esc(month)} ${emPousada(name)} <strong>${esc(name)}</strong>, nem noites ocupadas no mês.`,
      ticketHtml: opts.preview ? PREVIEW_NOTICE : '',
      extraHtml: notice(
        'Recebeu hóspedes por WhatsApp, telefone ou no balcão? Lance essas reservas no painel (Reservas → Nova reserva) para que a ocupação e a receita apareçam aqui e no painel.',
        'ok',
      ),
      cta: { href: link, label: 'Abrir o painel' },
      ctaHint: `Ou acesse <a href="${link}" style="color:${C.forest};font-weight:700;">o painel</a> em rotadaspousadas.com.br`,
      footerNote,
    })
    const text = [
      opts.preview ? '[Prévia — só para você; nada foi marcado como enviado]' : '',
      `Resumo de ${label} — ${name}`,
      '',
      `Não houve reservas com entrada em ${month}, nem noites ocupadas no mês.`,
      'Recebeu hóspedes por WhatsApp, telefone ou no balcão? Lance essas reservas no painel para que a ocupação e a receita apareçam no relatório.',
      '',
      `Painel: ${link}`,
    ]
      .filter((line, i) => i > 0 || line)
      .join('\n')
    return { subject, html, text }
  }

  const c = report.current
  const html = wrapLayout({
    preheader: `Ocupação de ${c.occupancyRate}% e ${formatCurrencyBRL(c.revenue)} em ${label}.`,
    pill: {
      label: opts.preview ? 'Prévia do relatório' : 'Relatório do mês',
      bg: C.accent,
      fg: C.accentText,
    },
    title: `Como foi ${month}`,
    subtitle: `${name} · ${label}`,
    intro: `Olá! Aqui está o resumo de ${esc(month)} ${emPousada(name) === 'no' ? 'do' : 'da'} <strong>${esc(name)}</strong>, com a comparação com ${esc(monthName(report.previous.month))}.`,
    ticketHtml:
      (opts.preview ? PREVIEW_NOTICE + '<div style="height:18px;"></div>' : '') + kpiTable(report),
    extraHtml: originsBlock(report) + howWeCount(report),
    cta: { href: link, label: 'Abrir o painel' },
    ctaHint: `Ou acesse <a href="${link}" style="color:${C.forest};font-weight:700;">o painel</a> em rotadaspousadas.com.br`,
    footerNote,
  })

  const vs = `vs. ${monthName(report.previous.month)}`
  const text = [
    opts.preview ? '[Prévia — só para você; nada foi marcado como enviado]' : '',
    `Resumo de ${label} — ${name}`,
    '',
    ...kpis(report).map(
      (k) =>
        `${k.label}: ${k.value} (${TEXT_ARROW[k.variation.direction]}${k.variation.label} ${vs})`,
    ),
    '',
    'De onde vieram as reservas:',
    ...c.origins.map(
      (o) =>
        `- ${o.label}: ${plural(o.bookings, 'reserva', 'reservas')} · ${formatCurrencyBRL(o.revenue)}`,
    ),
    '',
    'Mesmos números do painel: receita, reservas e noites das estadias com entrada no mês; ocupação = noites ocupadas ÷ noites disponíveis dos quartos ativos.',
    '',
    `Painel: ${link}`,
  ]
    .filter((line, i) => i > 0 || line)
    .join('\n')
  return { subject, html, text }
}
