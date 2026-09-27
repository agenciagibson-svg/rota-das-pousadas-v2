import { publicEnv } from '@/lib/env'
import type { BookingNotificationContext } from '@/repositories/bookings.repository'

/**
 * Templates dos 3 e-mails transacionais (visual aprovado em 27/09/2026 — mesma
 * identidade do site: verde-floresta, fundo linho, CTA laranja, logo da
 * bússola e títulos com serifa):
 * 1. Pedido recebido (reserva `pending`) — `createBooking`
 *    (features/reservas/services/bookings.service.ts).
 * 2. Reserva confirmada / comprovante — webhook do Mercado Pago
 *    (features/pagamentos/services/webhook.service.ts).
 * 3. Lembrete de check-in — cron diário (app/api/cron/expiracao).
 * 4. Nova senha (link) e 5. Senha alterada — "Esqueci minha senha"
 *    (features/auth/services/password-reset.service.ts).
 *
 * Regras de e-mail: só tabelas e estilo inline (Gmail/Outlook ignoram <style>
 * e SVG); fontes do site com fallback (Gmail cai em Georgia/Arial); logo é PNG
 * hospedado em /email/logo-compass.png. Todo texto vindo do banco passa por
 * `esc()` — regras da casa e política de cancelamento são digitadas pelo dono.
 * Os e-mails linkam de volta pra `/minhas-reservas` em vez de duplicar o painel.
 */

const C = {
  linen: '#f8f6f1',
  forest: '#0f766e',
  ink: '#1f2420',
  muted: '#6b6459',
  border: '#e4ddd0',
  accent: '#f97316',
  heroText: '#cfe7e3',
  footerText: '#a8a296',
}
const SERIF = "'Fraunces',Georgia,'Times New Roman',serif"
const SANS = "'Manrope',Arial,Helvetica,sans-serif"
const DEFAULT_TZ = 'America/Sao_Paulo'
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** Palavras iniciais masculinas comuns em nomes de hospedagem ("no Refúgio…"). */
const MASCULINE_FIRST_WORDS = new Set([
  'refúgio',
  'refugio',
  'recanto',
  'hotel',
  'chalé',
  'chale',
  'sítio',
  'sitio',
  'rancho',
  'canto',
  'cantinho',
  'vale',
  'paraíso',
  'paraiso',
  'espaço',
  'espaco',
  'solar',
  'morro',
  'mirante',
  'hostel',
  'lodge',
  'retiro',
  'casarão',
  'casarao',
  'porto',
  'jardim',
  'bosque',
  'resort',
  'hotelzinho',
  'ninho',
  'abrigo',
  'rincão',
  'rincao',
  'engenho',
  'alto',
])

/** "no" ou "na" antes do nome da pousada: "no Refúgio das Nuvens", "na Pousada Sol". */
export function emPousada(name: string): 'no' | 'na' {
  const first = name.trim().split(/\s+/)[0]?.toLocaleLowerCase('pt-BR') ?? ''
  return MASCULINE_FIRST_WORDS.has(first) ? 'no' : 'na'
}

export function esc(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseIsoDate(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return { y, m, d }
}

function formatDateBR(isoDate: string): string {
  const { y, m, d } = parseIsoDate(isoDate)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

/** "sáb, 27/09" — dia da semana calculado sem fuso (a data já é local). */
function formatDayShort(isoDate: string, withYear = false): string {
  const { y, m, d } = parseIsoDate(isoDate)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const date = withYear ? formatDateBR(isoDate) : formatDateBR(isoDate).slice(0, 5)
  return `${weekday}, ${date}`
}

/** "27 a 29 de setembro" / "30 de setembro a 2 de outubro". */
export function formatStayRange(checkin: string, checkout: string): string {
  const a = parseIsoDate(checkin)
  const b = parseIsoDate(checkout)
  if (a.m === b.m && a.y === b.y) return `${a.d} a ${b.d} de ${MONTHS[a.m - 1]}`
  return `${a.d} de ${MONTHS[a.m - 1]} a ${b.d} de ${MONTHS[b.m - 1]}`
}

/** "27 de setembro". */
function formatDayMonth(isoDate: string): string {
  const { m, d } = parseIsoDate(isoDate)
  return `${d} de ${MONTHS[m - 1]}`
}

function nightsBetween(checkin: string, checkout: string): number {
  const a = parseIsoDate(checkin)
  const b = parseIsoDate(checkout)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_TZ
  }
}

/**
 * "hoje, 22:42" / "amanhã, 01:15" / "28/09, 10:00" — no fuso da pousada,
 * relativo a `now` (injetável nos testes).
 */
export function formatDeadline(iso: string, timeZone?: string | null, now = new Date()): string {
  const tz = safeTimeZone(timeZone)
  const due = new Date(iso)
  const day = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(due)
  const tomorrow = new Date(now.getTime() + 86_400_000)
  if (day(due) === day(now)) return `hoje, ${time}`
  if (day(due) === day(tomorrow)) return `amanhã, ${time}`
  return `${formatDateBR(day(due)).slice(0, 5)}, ${time}`
}

function guestsLine(ctx: BookingNotificationContext): string | null {
  const nights = nightsBetween(ctx.checkin, ctx.checkout)
  const nightsText = `${nights} ${nights === 1 ? 'noite' : 'noites'}`
  if (!ctx.adults) return nightsText
  const parts = [`${ctx.adults} ${ctx.adults === 1 ? 'adulto' : 'adultos'}`]
  if (ctx.children) parts.push(`${ctx.children} ${ctx.children === 1 ? 'criança' : 'crianças'}`)
  return `${parts.join(', ')} · ${nightsText}`
}

function addressLine(ctx: BookingNotificationContext): string | null {
  const place = [ctx.pousada.city, ctx.pousada.state].filter(Boolean).join('/')
  if (ctx.pousada.address && place) return `${ctx.pousada.address} — ${place}`
  return ctx.pousada.address || place || null
}

function firstName(name: string | null): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0]
  return first || null
}

// ---------------------------------------------------------------------------
// Blocos de layout
// ---------------------------------------------------------------------------

function logoImg(size: number): string {
  return `<img src="${publicEnv.siteUrl}/email/logo-compass.png" width="${size}" height="${size}" alt="" style="display:inline-block;border:0;vertical-align:middle;border-radius:50%;">`
}

function infoRow(
  label: string,
  value: string,
  opts: { strong?: boolean; last?: boolean } = {},
): string {
  const bb = opts.last ? '' : `border-bottom:1px solid ${C.border};`
  const valueStyle = opts.strong
    ? `font:700 17px ${SANS};color:${C.forest};`
    : `font:600 14px ${SANS};color:${C.ink};`
  return `<tr><td style="padding:11px 0;${bb}font:500 13px ${SANS};color:${C.muted};">${esc(label)}</td><td align="right" style="padding:11px 0 11px 12px;${bb}${valueStyle}">${esc(value)}</td></tr>`
}

function rowsTable(
  rows: [string, string | null][],
  totalLabel?: string,
  totalValue?: string,
): string {
  const visible = rows.filter((r): r is [string, string] => Boolean(r[1]))
  const html = visible
    .map(([label, value], i) =>
      infoRow(label, value, { last: !totalLabel && i === visible.length - 1 }),
    )
    .join('')
  const total =
    totalLabel && totalValue ? infoRow(totalLabel, totalValue, { strong: true, last: true }) : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${html}${total}</table>`
}

function ticket(ctx: BookingNotificationContext, rowsHtml: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};border:1px solid ${C.border};border-radius:16px;">
  <tr><td style="padding:18px 22px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font:700 10px ${SANS};letter-spacing:2px;text-transform:uppercase;color:${C.muted};">Código da reserva</td>
      <td align="right" style="font:700 10px ${SANS};letter-spacing:2px;text-transform:uppercase;color:${C.muted};">${esc(ctx.pousada.name)}</td>
    </tr><tr>
      <td colspan="2" style="padding-top:4px;font:600 26px ${SERIF};color:${C.ink};letter-spacing:1px;">${esc(ctx.code)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 22px;"><div style="border-top:2px dashed ${C.border};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:4px 22px 10px;">${rowsHtml}</td></tr>
</table>`
}

function notice(html: string, tone: 'warn' | 'ok'): string {
  const s =
    tone === 'warn'
      ? 'background:#fff4eb;border:1px solid #fed7b5;color:#7c2d12;'
      : 'background:#ecfdf5;border:1px solid #bbe5d9;color:#134e4a;'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td style="padding:14px 18px;border-radius:14px;${s}font:500 14px/1.5 ${SANS};">${html}</td></tr></table>`
}

function arrivalNotice(ctx: BookingNotificationContext): string {
  const lines = [
    `<strong>Chegando lá:</strong> check-in a partir das ${esc(ctx.pousada.checkinTime)}, check-out até ${esc(ctx.pousada.checkoutTime)}.`,
  ]
  if (ctx.pousada.whatsapp) {
    lines.push(
      `<a href="https://wa.me/55${onlyDigits(ctx.pousada.whatsapp)}" style="color:${C.forest};font-weight:700;">Falar com a pousada no WhatsApp</a>`,
    )
  } else if (ctx.pousada.contactPhone) {
    lines.push(`Contato da pousada: ${esc(ctx.pousada.contactPhone)}`)
  }
  return notice(lines.join('<br>'), 'ok')
}

type LayoutParams = {
  preheader: string
  pill: { label: string; bg: string; fg: string }
  title: string
  subtitle: string
  intro: string
  ticketHtml: string
  extraHtml?: string
  cta: { href: string; label: string }
  /** Linha sob o botão (HTML). Padrão: atalho para Minhas reservas. */
  ctaHint?: string
  /** Rodapé (HTML). Padrão: "Você recebeu este e-mail porque fez uma reserva…". */
  footerNote?: string
}

function wrapLayout(p: LayoutParams): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(p.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.linen};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(p.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};padding:28px 0;">
<tr><td align="center" style="padding:0 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:0 12px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>${logoImg(40)}<span style="font:600 20px ${SERIF};color:${C.ink};vertical-align:middle;padding-left:10px;">Rota das Pousadas</span></td>
      <td align="right" style="font:600 10px ${SANS};letter-spacing:2px;text-transform:uppercase;color:${C.muted};">Cada destino tem uma história</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${C.forest};border-radius:22px 22px 0 0;padding:34px 36px 30px;">
    <span style="display:inline-block;background:${p.pill.bg};color:${p.pill.fg};font:700 11px ${SANS};letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${esc(p.pill.label)}</span>
    <h1 style="margin:16px 0 6px;font:600 30px/1.15 ${SERIF};color:${C.linen};">${esc(p.title)}</h1>
    <p style="margin:0;font:500 15px/1.5 ${SANS};color:${C.heroText};">${esc(p.subtitle)}</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:30px 36px 8px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};">
    <p style="margin:0 0 22px;font:500 15px/1.6 ${SANS};color:${C.ink};">${p.intro}</p>
    ${p.ticketHtml}
    ${p.extraHtml ?? ''}
  </td></tr>
  <tr><td align="center" style="background:#ffffff;padding:18px 36px 34px;border:1px solid ${C.border};border-top:0;border-radius:0 0 22px 22px;">
    <a href="${p.cta.href}" style="display:inline-block;background:${C.accent};color:#ffffff;font:700 15px ${SANS};text-decoration:none;padding:15px 34px;border-radius:999px;">${esc(p.cta.label)} &rarr;</a>
    <p style="margin:14px 0 0;font:500 12px ${SANS};color:${C.muted};">${p.ctaHint ?? `Ou acesse <a href="${p.cta.href}" style="color:${C.forest};font-weight:700;">Minhas reservas</a> em rotadaspousadas.com.br`}</p>
  </td></tr>
  <tr><td style="padding:22px 12px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};border-radius:18px;"><tr><td style="padding:22px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="52" valign="middle">${logoImg(38)}</td>
        <td valign="middle"><div style="font:600 16px ${SERIF};color:${C.linen};">Rota das Pousadas</div>
          <div style="font:500 12px/1.5 ${SANS};color:${C.footerText};margin-top:2px;">Reserva direto com a pousada, sem intermediário na hospedagem.</div></td>
      </tr></table>
    </td></tr></table>
    <p style="margin:14px 0 0;text-align:center;font:500 11px/1.6 ${SANS};color:${C.muted};">${p.footerNote ?? 'Você recebeu este e-mail porque fez uma reserva em rotadaspousadas.com.br.<br>Dúvidas sobre a estadia? Fale direto com a pousada.'}</p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// E-mails
// ---------------------------------------------------------------------------

type Email = { subject: string; html: string; text: string }

function greeting(ctx: BookingNotificationContext): string {
  const name = firstName(ctx.guestName)
  return name ? `Olá, <strong>${esc(name)}</strong>!` : 'Olá!'
}

export function bookingRequestReceivedEmail(
  ctx: BookingNotificationContext,
  now = new Date(),
): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Recebemos seu pedido — ${ctx.pousada.name} (${ctx.code})`
  const deadline = ctx.paymentDueAt
    ? formatDeadline(ctx.paymentDueAt, ctx.pousada.timezone, now)
    : null
  const rows = rowsTable(
    [
      ['Acomodação', ctx.roomName],
      ['Check-in', formatDayShort(ctx.checkin, true)],
      ['Check-out', formatDayShort(ctx.checkout, true)],
      ['Hóspedes', guestsLine(ctx)],
    ],
    'Total',
    formatCurrencyBRL(ctx.total),
  )
  const deadlineHtml = deadline
    ? notice(
        `<strong style="color:#c2410c;">Pague até ${esc(deadline)}</strong> — depois disso a reserva é cancelada e as datas voltam a ficar livres.`,
        'warn',
      )
    : notice(
        'Conclua o pagamento para garantir a acomodação. O prazo aparece na sua página de reservas.',
        'warn',
      )
  const html = wrapLayout({
    preheader: deadline
      ? `Pague até ${deadline} para garantir sua estadia.`
      : 'Conclua o pagamento para garantir sua estadia.',
    pill: { label: 'Aguardando pagamento', bg: C.accent, fg: '#ffffff' },
    title: 'Seu refúgio está quase garantido',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `${greeting(ctx)} Recebemos seu pedido de reserva ${emPousada(ctx.pousada.name)} <strong>${esc(ctx.pousada.name)}</strong>. Só falta o pagamento para confirmar.`,
    ticketHtml: ticket(ctx, rows),
    extraHtml: deadlineHtml,
    cta: { href: link, label: 'Concluir pagamento' },
  })
  const text = [
    `Recebemos seu pedido de reserva ${emPousada(ctx.pousada.name)} ${ctx.pousada.name}.`,
    `Código: ${ctx.code}`,
    `Acomodação: ${ctx.roomName}`,
    `Check-in: ${formatDateBR(ctx.checkin)}`,
    `Check-out: ${formatDateBR(ctx.checkout)}`,
    `Total: ${formatCurrencyBRL(ctx.total)}`,
    deadline ? `Pague até ${deadline}; depois disso a reserva é cancelada.` : '',
    '',
    `Conclua o pagamento em: ${link}`,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n')
  return { subject, html, text }
}

export function bookingConfirmedEmail(ctx: BookingNotificationContext): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Reserva confirmada — ${ctx.pousada.name} (${ctx.code})`
  const rows = rowsTable(
    [
      ['Acomodação', ctx.roomName],
      ['Check-in', `${formatDayShort(ctx.checkin)} · a partir das ${ctx.pousada.checkinTime}`],
      ['Check-out', `${formatDayShort(ctx.checkout)} · até ${ctx.pousada.checkoutTime}`],
      ['Hóspedes', guestsLine(ctx)],
      ['Endereço', addressLine(ctx)],
    ],
    'Total pago',
    formatCurrencyBRL(ctx.total),
  )
  const policies: string[] = []
  if (ctx.pousada.houseRules) {
    policies.push(
      `<strong style="color:${C.ink};">Regras da casa:</strong> ${esc(ctx.pousada.houseRules)}`,
    )
  }
  if (ctx.pousada.cancellationPolicy) {
    policies.push(
      `<strong style="color:${C.ink};">Cancelamento:</strong> ${esc(ctx.pousada.cancellationPolicy)}`,
    )
  }
  const policiesHtml = policies.length
    ? `<p style="margin:16px 0 0;font:500 12px/1.6 ${SANS};color:${C.muted};">${policies.join('<br>')}</p>`
    : ''
  const html = wrapLayout({
    preheader: `Reserva ${ctx.code} confirmada. Guarde este e-mail como comprovante.`,
    pill: { label: 'Confirmada', bg: '#d1fae5', fg: '#065f46' },
    title: 'Tudo certo, sua estadia está confirmada',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `Pagamento recebido. Guarde este e-mail: ele é o seu comprovante da reserva ${emPousada(ctx.pousada.name)} <strong>${esc(ctx.pousada.name)}</strong>.`,
    ticketHtml: ticket(ctx, rows),
    extraHtml: arrivalNotice(ctx) + policiesHtml,
    cta: { href: link, label: 'Ver minha reserva' },
  })
  const address = addressLine(ctx)
  const text = `Sua reserva ${emPousada(ctx.pousada.name)} ${ctx.pousada.name} está confirmada.\nCódigo: ${ctx.code}\nAcomodação: ${ctx.roomName}\nCheck-in: ${formatDateBR(ctx.checkin)} (a partir das ${ctx.pousada.checkinTime})\nCheck-out: ${formatDateBR(ctx.checkout)} (até ${ctx.pousada.checkoutTime})\nTotal pago: ${formatCurrencyBRL(ctx.total)}\n${address ? `Endereço: ${address}\n` : ''}\nVeja os detalhes em: ${link}`
  return { subject, html, text }
}

export function checkinReminderEmail(ctx: BookingNotificationContext, now = new Date()): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Sua estadia ${emPousada(ctx.pousada.name)} ${ctx.pousada.name} está chegando — check-in ${formatDateBR(ctx.checkin)}`
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(ctx.pousada.timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const daysLeft = Math.max(0, nightsBetween(today, ctx.checkin))
  const pillLabel =
    daysLeft === 0 ? 'É hoje' : daysLeft === 1 ? 'Falta 1 dia' : `Faltam ${daysLeft} dias`
  const rows = rowsTable([
    ['Check-in', `${formatDayShort(ctx.checkin)} · a partir das ${ctx.pousada.checkinTime}`],
    ['Endereço', addressLine(ctx)],
    ['Hóspedes', guestsLine(ctx)],
  ])
  const html = wrapLayout({
    preheader: `Check-in ${formatDayShort(ctx.checkin)} ${emPousada(ctx.pousada.name)} ${ctx.pousada.name}.`,
    pill: { label: pillLabel, bg: C.linen, fg: C.forest },
    title: 'Arrume as malas: sua viagem está chegando',
    subtitle: `${ctx.pousada.name} · check-in em ${formatDayMonth(ctx.checkin)}`,
    intro: `Faltam poucos dias para sua estadia ${emPousada(ctx.pousada.name)} <strong>${esc(ctx.pousada.name)}</strong>. Aqui vai o essencial para a chegada.`,
    ticketHtml: ticket(ctx, rows),
    extraHtml: arrivalNotice(ctx),
    cta: { href: link, label: 'Ver detalhes da reserva' },
  })
  const address = addressLine(ctx)
  const text = `Faltam poucos dias para sua estadia ${emPousada(ctx.pousada.name)} ${ctx.pousada.name}.\nCódigo: ${ctx.code}\nCheck-in: ${formatDateBR(ctx.checkin)} (a partir das ${ctx.pousada.checkinTime})\n${address ? `Endereço: ${address}\n` : ''}\nDetalhes em: ${link}`
  return { subject, html, text }
}

// ---------------------------------------------------------------------------
// Conta: nova senha
// ---------------------------------------------------------------------------

function helloName(name: string | null): string {
  const first = firstName(name)
  return first ? `Olá, <strong>${esc(first)}</strong>!` : 'Olá!'
}

/** Link para criar nova senha ("Esqueci minha senha"). Vale 1h, uso único. */
export function passwordResetEmail(p: { name: string | null; email: string; link: string }): Email {
  const subject = 'Crie sua nova senha — Rota das Pousadas'
  const safeLink = esc(p.link)
  const html = wrapLayout({
    preheader: 'Use o botão para criar sua nova senha. O link vale por 1 hora.',
    pill: { label: 'Nova senha', bg: '#fef3c7', fg: '#92400e' },
    title: 'Vamos criar sua nova senha',
    subtitle: 'O link vale por 1 hora e funciona uma única vez.',
    intro: `${helloName(p.name)} Recebemos um pedido para redefinir a senha da conta <strong>${esc(p.email)}</strong> na Rota das Pousadas. Toque no botão abaixo para escolher a nova senha.`,
    ticketHtml: '',
    extraHtml:
      notice(
        '<strong>Não foi você?</strong> Pode ignorar este e-mail. Sua senha atual continua valendo e ninguém consegue trocá-la sem este link.',
        'warn',
      ) +
      `<p style="margin:18px 0 0;font:500 12px/1.6 ${SANS};color:${C.muted};">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${safeLink}" style="color:${C.forest};word-break:break-all;">${safeLink}</a></p>`,
    cta: { href: safeLink, label: 'Criar nova senha' },
    ctaHint: 'Por segurança, não encaminhe este e-mail para ninguém.',
    footerNote:
      'Você recebeu este e-mail porque alguém pediu uma nova senha para esta conta em rotadaspousadas.com.br.',
  })
  const text = `Crie sua nova senha na Rota das Pousadas.\n\nConta: ${p.email}\nAbra o link (vale por 1 hora, uso único):\n${p.link}\n\nNão foi você? Ignore este e-mail — sua senha atual continua valendo.`
  return { subject, html, text }
}

/** Aviso de segurança depois que a senha foi trocada. */
export function passwordChangedEmail(p: {
  name: string | null
  loginUrl: string
  resetUrl: string
  now?: Date
}): Email {
  const when = new Intl.DateTimeFormat('pt-BR', {
    timeZone: DEFAULT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(p.now ?? new Date())
  const subject = 'Sua senha foi alterada — Rota das Pousadas'
  const html = wrapLayout({
    preheader: `A senha da sua conta foi alterada em ${when}.`,
    pill: { label: 'Segurança', bg: '#d1fae5', fg: '#065f46' },
    title: 'Sua senha foi alterada',
    subtitle: `Em ${when} (horário de Brasília)`,
    intro: `${helloName(p.name)} A senha da sua conta na Rota das Pousadas acabou de ser alterada. Por segurança, desconectamos os outros aparelhos em que a conta estava aberta.`,
    ticketHtml: '',
    extraHtml: notice(
      `<strong>Não foi você?</strong> Crie uma nova senha agora em <a href="${esc(p.resetUrl)}" style="color:#7c2d12;font-weight:700;">Esqueci minha senha</a> e confira suas reservas.`,
      'warn',
    ),
    cta: { href: esc(p.loginUrl), label: 'Entrar na minha conta' },
    ctaHint: 'Guarde sua senha em um lugar seguro.',
    footerNote:
      'Você recebeu este aviso de segurança porque a senha desta conta em rotadaspousadas.com.br foi alterada.',
  })
  const text = `A senha da sua conta na Rota das Pousadas foi alterada em ${when} (horário de Brasília).\nNão foi você? Crie uma nova senha agora: ${p.resetUrl}`
  return { subject, html, text }
}
