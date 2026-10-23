import { publicEnv } from '@/lib/env'
import type { BookingNotificationContext } from '@/repositories/bookings.repository'
import type { ReviewRequestTarget } from '@/repositories/reviews.repository'
import { REVIEW_RATINGS, reviewPagePath } from '@/features/estadia/review'
import { PAYMENT_REVIEW_TEXT, type PaymentReviewKind } from '@/features/pagamentos/pix'
import { emailOffersPrecheckin, precheckinPath } from '@/features/reservas/precheckin'

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
 * 6. Pedido de avaliação e lembrete único depois do check-out — cron diário
 *    (app/api/cron/expiracao, 0089).
 *
 * Regras de e-mail: só tabelas e estilo inline (Gmail/Outlook ignoram <style>
 * e SVG); fontes do site com fallback (Gmail cai em Arial); a marca é PNG
 * hospedado em /email/marca.png (e marca-negativo.png sobre fundo Breu).
 * `logo-compass.png` continua no ar só para e-mails antigos já enviados. Todo texto vindo do banco passa por
 * `esc()` — regras da casa e política de cancelamento são digitadas pelo dono.
 * Os e-mails linkam de volta pra `/minhas-reservas` em vez de duplicar o painel.
 */

/** Paleta da marca (docs/Marca.md): Neblina, Breu, Grafite e Ipê. */
const C = {
  linen: '#eef1ef',
  forest: '#0f1716',
  ink: '#0f1716',
  muted: '#4f5955',
  border: '#d5dbd8',
  accent: '#f4b42a',
  /** Texto sobre o Ipê: Breu (branco sobre Ipê não tem contraste). */
  accentText: '#0f1716',
  heroText: '#c9d0cc',
  footerText: '#a9b3ae',
}
const DISPLAY = "'Funnel Display','Helvetica Neue',Arial,sans-serif"
const SANS = "'Figtree','Helvetica Neue',Arial,Helvetica,sans-serif"
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

function logoImg(size: number, dark = false): string {
  const file = dark ? 'marca-negativo.png' : 'marca.png'
  return `<img src="${publicEnv.siteUrl}/email/${file}" width="${size}" height="${size}" alt="" style="display:inline-block;border:0;vertical-align:middle;">`
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
      <td style="font:600 12px ${SANS};color:${C.muted};">Código da reserva</td>
      <td align="right" style="font:600 12px ${SANS};color:${C.muted};">${esc(ctx.pousada.name)}</td>
    </tr><tr>
      <td colspan="2" style="padding-top:4px;font:500 26px ${DISPLAY};color:${C.ink};letter-spacing:1px;">${esc(ctx.code)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 22px;"><div style="border-top:2px dashed ${C.border};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:4px 22px 10px;">${rowsHtml}</td></tr>
</table>`
}

function notice(html: string, tone: 'warn' | 'ok'): string {
  const s =
    tone === 'warn'
      ? 'background:#fdf0d4;border:1px solid #f8d58a;color:#0f1716;'
      : 'background:#eaf0ed;border:1px solid #c1d2c9;color:#0f1716;'
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
<link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@500&family=Figtree:wght@500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.linen};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(p.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};padding:28px 0;">
<tr><td align="center" style="padding:0 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:0 12px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>${logoImg(40)}<span style="font:500 20px ${DISPLAY};color:${C.ink};vertical-align:middle;padding-left:10px;">Rota das Pousadas</span></td>
      <td align="right" style="font:500 12px ${SANS};color:${C.muted};">Cada destino tem uma história</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${C.forest};border-radius:22px 22px 0 0;padding:34px 36px 30px;">
    <span style="display:inline-block;background:${p.pill.bg};color:${p.pill.fg};font:600 12px ${SANS};padding:6px 12px;border-radius:999px;">${esc(p.pill.label)}</span>
    <h1 style="margin:16px 0 6px;font:500 30px/1.15 ${DISPLAY};color:${C.linen};">${esc(p.title)}</h1>
    <p style="margin:0;font:500 15px/1.5 ${SANS};color:${C.heroText};">${esc(p.subtitle)}</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:30px 36px 8px;border-left:1px solid ${C.border};border-right:1px solid ${C.border};">
    <p style="margin:0 0 22px;font:500 15px/1.6 ${SANS};color:${C.ink};">${p.intro}</p>
    ${p.ticketHtml}
    ${p.extraHtml ?? ''}
  </td></tr>
  <tr><td align="center" style="background:#ffffff;padding:18px 36px 34px;border:1px solid ${C.border};border-top:0;border-radius:0 0 22px 22px;">
    <a href="${p.cta.href}" style="display:inline-block;background:${C.accent};color:${C.accentText};font:700 15px ${SANS};text-decoration:none;padding:15px 34px;border-radius:999px;">${esc(p.cta.label)} &rarr;</a>
    <p style="margin:14px 0 0;font:500 12px ${SANS};color:${C.muted};">${p.ctaHint ?? `Ou acesse <a href="${p.cta.href}" style="color:${C.forest};font-weight:700;">Minhas reservas</a> em rotadaspousadas.com.br`}</p>
  </td></tr>
  <tr><td style="padding:22px 12px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ink};border-radius:18px;"><tr><td style="padding:22px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="52" valign="middle">${logoImg(38, true)}</td>
        <td valign="middle"><div style="font:500 16px ${DISPLAY};color:${C.linen};">Rota das Pousadas</div>
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
        `<strong style="color:${C.ink};">Pague até ${esc(deadline)}</strong> — depois disso a reserva é cancelada e as datas voltam a ficar livres.`,
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
    pill: { label: 'Aguardando pagamento', bg: C.accent, fg: C.accentText },
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

/** Bloco do app da estadia (0078): pedir pelo celular e falar com a recepção. */
function stayAppBlock(ctx: BookingNotificationContext): string {
  const href = esc(`${publicEnv.siteUrl}/estadia/${ctx.bookingId}`)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:${C.linen};border:1px solid ${C.border};border-radius:16px;">
<tr><td style="padding:16px 18px;">
<p style="margin:0;font:700 14px ${SANS};color:${C.ink};">App da sua estadia</p>
<p style="margin:6px 0 12px;font:500 13px/1.55 ${SANS};color:${C.muted};">Durante a hospedagem, peça água, bebidas, toalha extra e fale com a recepção pelo celular. O consumo vai para a conta e é pago no check-out. Abra o link e toque em “Adicionar à tela inicial”.</p>
<a href="${href}" style="display:inline-block;background:${C.ink};color:${C.linen};font:700 13px ${SANS};text-decoration:none;padding:10px 16px;border-radius:999px;">Abrir o app da estadia</a>
</td></tr></table>`
}

/** Link do pré-check-in (0088), ou `null` se a ficha já foi enviada. */
function precheckinLink(ctx: BookingNotificationContext): string | null {
  return emailOffersPrecheckin(ctx) ? `${publicEnv.siteUrl}${precheckinPath(ctx.bookingId)}` : null
}

/** Bloco "Preencher ficha de hospedagem" (0088): a recepção só confere na chegada. */
function precheckinBlock(link: string | null): string {
  if (!link) return ''
  const href = esc(link)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:${C.linen};border:1px solid ${C.border};border-radius:16px;">
<tr><td style="padding:16px 18px;">
<p style="margin:0;font:700 14px ${SANS};color:${C.ink};">Adiante seu check-in</p>
<p style="margin:6px 0 12px;font:500 13px/1.55 ${SANS};color:${C.muted};">Preencha a ficha de hospedagem agora, com seus dados e os de quem vai com você. Leva poucos minutos e, na chegada, é só confirmar com a recepção.</p>
<a href="${href}" style="display:inline-block;background:${C.ink};color:${C.linen};font:700 13px ${SANS};text-decoration:none;padding:10px 16px;border-radius:999px;">Preencher ficha de hospedagem</a>
</td></tr></table>`
}

function precheckinTextLine(link: string | null): string {
  return link ? `\nPreencher ficha de hospedagem: ${link}` : ''
}

export function bookingConfirmedEmail(ctx: BookingNotificationContext): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const fichaLink = precheckinLink(ctx)
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
    pill: { label: 'Confirmada', bg: '#e2ece6', fg: '#2f6a4f' },
    title: 'Tudo certo, sua estadia está confirmada',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `Pagamento recebido. Guarde este e-mail: ele é o seu comprovante da reserva ${emPousada(ctx.pousada.name)} <strong>${esc(ctx.pousada.name)}</strong>.`,
    ticketHtml: ticket(ctx, rows),
    extraHtml: precheckinBlock(fichaLink) + arrivalNotice(ctx) + stayAppBlock(ctx) + policiesHtml,
    cta: { href: link, label: 'Ver minha reserva' },
  })
  const address = addressLine(ctx)
  const text = `Sua reserva ${emPousada(ctx.pousada.name)} ${ctx.pousada.name} está confirmada.\nCódigo: ${ctx.code}\nAcomodação: ${ctx.roomName}\nCheck-in: ${formatDateBR(ctx.checkin)} (a partir das ${ctx.pousada.checkinTime})\nCheck-out: ${formatDateBR(ctx.checkout)} (até ${ctx.pousada.checkoutTime})\nTotal pago: ${formatCurrencyBRL(ctx.total)}\n${address ? `Endereço: ${address}\n` : ''}\nVeja os detalhes em: ${link}${precheckinTextLine(fichaLink)}\nApp da estadia (pedidos e recepção): ${publicEnv.siteUrl}/estadia/${ctx.bookingId}`
  return { subject, html, text }
}

export function checkinReminderEmail(ctx: BookingNotificationContext, now = new Date()): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const fichaLink = precheckinLink(ctx)
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
    extraHtml: precheckinBlock(fichaLink) + arrivalNotice(ctx) + stayAppBlock(ctx),
    cta: { href: link, label: 'Ver detalhes da reserva' },
  })
  const address = addressLine(ctx)
  const text = `Faltam poucos dias para sua estadia ${emPousada(ctx.pousada.name)} ${ctx.pousada.name}.\nCódigo: ${ctx.code}\nCheck-in: ${formatDateBR(ctx.checkin)} (a partir das ${ctx.pousada.checkinTime})\n${address ? `Endereço: ${address}\n` : ''}\nDetalhes em: ${link}${precheckinTextLine(fichaLink)}\nApp da estadia (pedidos e recepção): ${publicEnv.siteUrl}/estadia/${ctx.bookingId}`
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
    pill: { label: 'Nova senha', bg: C.accent, fg: C.accentText },
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
    pill: { label: 'Segurança', bg: '#e2ece6', fg: '#2f6a4f' },
    title: 'Sua senha foi alterada',
    subtitle: `Em ${when} (horário de Brasília)`,
    intro: `${helloName(p.name)} A senha da sua conta na Rota das Pousadas acabou de ser alterada. Por segurança, desconectamos os outros aparelhos em que a conta estava aberta.`,
    ticketHtml: '',
    extraHtml: notice(
      `<strong>Não foi você?</strong> Crie uma nova senha agora em <a href="${esc(p.resetUrl)}" style="color:${C.ink};font-weight:700;">Esqueci minha senha</a> e confira suas reservas.`,
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

// ---------------------------------------------------------------------------
// Pix direto (0075): comprovante recebido / aviso à pousada / recusado
// ---------------------------------------------------------------------------

/** Hóspede: comprovante chegou e está em análise pela pousada. */
export function paymentProofReceivedEmail(ctx: BookingNotificationContext, amount: number): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Comprovante recebido — ${ctx.pousada.name} (${ctx.code})`
  const rows = rowsTable(
    [
      ['Acomodação', ctx.roomName],
      ['Check-in', formatDayShort(ctx.checkin, true)],
      ['Check-out', formatDayShort(ctx.checkout, true)],
    ],
    'Valor do Pix',
    formatCurrencyBRL(amount),
  )
  const html = wrapLayout({
    preheader: 'A pousada vai conferir o seu Pix e confirmar a reserva.',
    pill: { label: 'Em análise', bg: C.linen, fg: C.ink },
    title: 'Recebemos o seu comprovante',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `${greeting(ctx)} O comprovante do Pix da reserva <strong>${esc(ctx.code)}</strong> chegou. Agora a pousada confere o valor na conta dela e confirma a sua reserva — você recebe outro e-mail assim que isso acontecer.`,
    ticketHtml: ticket(ctx, rows),
    extraHtml: notice(
      'Enquanto a pousada confere, <strong>suas datas continuam guardadas</strong>. Não precisa pagar de novo.',
      'ok',
    ),
    cta: { href: link, label: 'Acompanhar reserva' },
  })
  const text = `Recebemos o comprovante do Pix da reserva ${ctx.code} (${ctx.pousada.name}).\nValor: ${formatCurrencyBRL(amount)}\nA pousada vai conferir e confirmar a reserva; suas datas continuam guardadas.\nAcompanhe em: ${link}`
  return { subject, html, text }
}

/** Pousada: novo comprovante para conferir e aprovar. */
export function paymentProofAlertEmail(ctx: BookingNotificationContext, amount: number): Email {
  const link = `${publicEnv.siteUrl}/dashboard/reservas/${ctx.bookingId}`
  const subject = `Pix para conferir — ${ctx.code} (${formatCurrencyBRL(amount)})`
  const rows = rowsTable(
    [
      ['Hóspede', ctx.guestName ?? 'Hóspede'],
      ['Acomodação', ctx.roomName],
      ['Check-in', formatDayShort(ctx.checkin, true)],
      ['Check-out', formatDayShort(ctx.checkout, true)],
    ],
    'Valor esperado',
    formatCurrencyBRL(amount),
  )
  const html = wrapLayout({
    preheader: `O hóspede enviou o comprovante do Pix da reserva ${ctx.code}.`,
    pill: { label: 'Aprovar pagamento', bg: C.accent, fg: C.accentText },
    title: 'Chegou um comprovante de Pix',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `O hóspede da reserva <strong>${esc(ctx.code)}</strong> enviou o comprovante do Pix. Confira se o valor caiu na conta da pousada e aprove (ou recuse) no painel.`,
    ticketHtml: ticket(ctx, rows),
    extraHtml: notice(
      ctx.paymentDueAt
        ? `As datas ficam guardadas para esse hóspede <strong>até ${esc(formatDeadline(ctx.paymentDueAt, ctx.pousada.timezone, new Date()))}</strong>. Se ninguém analisar até lá, a reserva é cancelada e o caso vai para "Pagamentos para revisar". Aprovando, a reserva é confirmada.`
        : 'Enquanto você não decide, as datas ficam guardadas para esse hóspede. Aprovando, a reserva é confirmada e o hóspede recebe o comprovante por e-mail.',
      'warn',
    ),
    cta: { href: link, label: 'Conferir comprovante' },
    ctaHint: 'Abre a reserva no painel da pousada.',
    footerNote:
      'Você recebeu este aviso porque faz parte da equipe desta pousada na Rota das Pousadas.',
  })
  const text = `Novo comprovante de Pix para conferir.\nReserva: ${ctx.code}\nHóspede: ${ctx.guestName ?? '—'}\nValor esperado: ${formatCurrencyBRL(amount)}\nConfira e aprove em: ${link}`
  return { subject, html, text }
}

/** Hóspede: a pousada confirmou só parte do valor; falta pagar o restante. */
export function paymentPartialEmail(
  ctx: BookingNotificationContext,
  received: number,
  remaining: number,
  now = new Date(),
): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Falta pagar ${formatCurrencyBRL(remaining)} — ${ctx.pousada.name} (${ctx.code})`
  const deadline = ctx.paymentDueAt
    ? formatDeadline(ctx.paymentDueAt, ctx.pousada.timezone, now)
    : null
  const html = wrapLayout({
    preheader: `A pousada confirmou ${formatCurrencyBRL(received)}. Falta ${formatCurrencyBRL(remaining)}.`,
    pill: { label: 'Pagamento parcial', bg: C.accent, fg: C.accentText },
    title: 'Recebemos parte do pagamento',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `${greeting(ctx)} A pousada confirmou <strong>${formatCurrencyBRL(received)}</strong> na reserva <strong>${esc(ctx.code)}</strong>. Para confirmar a reserva, falta pagar <strong>${formatCurrencyBRL(remaining)}</strong>.`,
    ticketHtml: '',
    extraHtml: notice(
      deadline
        ? `Pague o restante e envie o comprovante <strong>até ${esc(deadline)}</strong>. Depois disso a reserva é cancelada.`
        : 'Pague o restante e envie o comprovante pela página da reserva.',
      'warn',
    ),
    cta: { href: link, label: 'Pagar o restante' },
  })
  const text = `A pousada confirmou ${formatCurrencyBRL(received)} da reserva ${ctx.code} (${ctx.pousada.name}). Falta ${formatCurrencyBRL(remaining)}.\n${deadline ? `Pague até ${deadline}.\n` : ''}Acesse: ${link}`
  return { subject, html, text }
}

/** Pousada: um caso de dinheiro entrou na fila "Pagamentos para revisar". */
export function paymentReviewAlertEmail(
  ctx: BookingNotificationContext,
  kind: PaymentReviewKind,
  amount: number,
): Email {
  const link = `${publicEnv.siteUrl}/dashboard`
  const info = PAYMENT_REVIEW_TEXT[kind]
  const subject = `Pagamento para revisar — ${ctx.code} (${formatCurrencyBRL(amount)})`
  const rows = rowsTable(
    [
      ['Hóspede', ctx.guestName ?? 'Hóspede'],
      ['Acomodação', ctx.roomName],
      ['Check-in', formatDayShort(ctx.checkin, true)],
    ],
    'Valor',
    formatCurrencyBRL(amount),
  )
  const html = wrapLayout({
    preheader: info.title,
    pill: { label: 'Revisar pagamento', bg: '#f6e0db', fg: '#b3412a' },
    title: info.title,
    subtitle: `${ctx.pousada.name} · reserva ${ctx.code}`,
    intro: esc(info.action),
    ticketHtml: ticket(ctx, rows),
    extraHtml: notice(
      'Depois de resolver, registre o que foi feito no painel (Visão geral → Pagamentos para revisar).',
      'warn',
    ),
    cta: { href: link, label: 'Abrir o painel' },
    footerNote:
      'Você recebeu este aviso porque faz parte da equipe desta pousada na Rota das Pousadas.',
  })
  const text = `${info.title}\nReserva: ${ctx.code}\nValor: ${formatCurrencyBRL(amount)}\n${info.action}\nPainel: ${link}`
  return { subject, html, text }
}

/** Hóspede: pousada recusou o comprovante (motivo + novo prazo). */
export function paymentProofRejectedEmail(
  ctx: BookingNotificationContext,
  reason: string,
  now = new Date(),
): Email {
  const link = `${publicEnv.siteUrl}/minhas-reservas`
  const subject = `Comprovante não aprovado — ${ctx.pousada.name} (${ctx.code})`
  const deadline = ctx.paymentDueAt
    ? formatDeadline(ctx.paymentDueAt, ctx.pousada.timezone, now)
    : null
  const html = wrapLayout({
    preheader: 'A pousada não conseguiu confirmar o seu Pix. Veja o motivo.',
    pill: { label: 'Ação necessária', bg: '#f6e0db', fg: '#b3412a' },
    title: 'A pousada não confirmou o seu Pix',
    subtitle: `${ctx.pousada.name} · ${formatStayRange(ctx.checkin, ctx.checkout)}`,
    intro: `${greeting(ctx)} A pousada analisou o comprovante da reserva <strong>${esc(ctx.code)}</strong> e não conseguiu confirmar o pagamento.`,
    ticketHtml: '',
    extraHtml:
      notice(`<strong>Motivo:</strong> ${esc(reason)}`, 'warn') +
      notice(
        deadline
          ? `Você pode enviar outro comprovante ou pagar de outra forma <strong>até ${esc(deadline)}</strong>. Depois disso a reserva é cancelada.`
          : 'Envie outro comprovante ou pague de outra forma pela página da reserva.',
        'warn',
      ),
    cta: { href: link, label: 'Resolver pagamento' },
  })
  const text = `A pousada não confirmou o Pix da reserva ${ctx.code} (${ctx.pousada.name}).\nMotivo: ${reason}\n${deadline ? `Envie outro comprovante ou pague até ${deadline}.\n` : ''}Acesse: ${link}`
  return { subject, html, text }
}

/**
 * Convite para a equipe de uma pousada. Vai para qualquer e-mail convidado —
 * o texto serve para quem já tem conta (entra e aceita no painel) e para quem
 * ainda não tem (cria a conta com o mesmo e-mail e pede um novo convite). Não
 * revela se o e-mail tem conta na plataforma.
 */
export function memberInviteEmail(p: {
  pousadaName: string
  roleLabel: string
  inviterName: string | null
  email: string
  dashboardUrl: string
  signupUrl: string
}): Email {
  const subject = `Convite para a equipe ${emPousada(p.pousadaName) === 'na' ? 'da' : 'do'} ${p.pousadaName}`
  const who = p.inviterName
    ? `<strong>${esc(p.inviterName)}</strong> convidou você`
    : 'Você foi convidado'
  const html = wrapLayout({
    preheader: `Você foi convidado para a equipe ${p.pousadaName} como ${p.roleLabel}.`,
    pill: { label: 'Convite de equipe', bg: C.linen, fg: C.ink },
    title: `Bem-vindo à equipe`,
    subtitle: `${p.pousadaName} · ${p.roleLabel}`,
    intro: `${who} para fazer parte da equipe de <strong>${esc(p.pousadaName)}</strong> no painel da Rota das Pousadas, com o papel de <strong>${esc(p.roleLabel)}</strong>.`,
    ticketHtml: '',
    extraHtml:
      notice(
        `<strong>Já tem conta com ${esc(p.email)}?</strong> Entre no painel e toque em “Aceitar convite”.`,
        'ok',
      ) +
      notice(
        `<strong>Ainda não tem conta?</strong> Crie uma com este mesmo e-mail em <a href="${esc(p.signupUrl)}" style="color:${C.forest};">${esc(p.signupUrl)}</a> e peça para a pousada enviar o convite de novo.`,
        'warn',
      ),
    cta: { href: esc(p.dashboardUrl), label: 'Abrir o painel' },
    ctaHint: 'Se você não esperava este convite, pode ignorar este e-mail.',
    footerNote: 'Você recebeu este e-mail porque uma pousada convidou este endereço para a equipe.',
  })
  const text = `Você foi convidado para a equipe de ${p.pousadaName} (${p.roleLabel}) na Rota das Pousadas.\n\nJá tem conta com ${p.email}? Entre em ${p.dashboardUrl} e aceite o convite.\nAinda não tem? Crie uma com este mesmo e-mail em ${p.signupUrl} e peça um novo convite.\n\nSe não esperava este convite, ignore este e-mail.`
  return { subject, html, text }
}

// ---------------------------------------------------------------------------
// Pedido de avaliação depois do check-out (0089)
// ---------------------------------------------------------------------------

const RATING_LABEL: Record<number, string> = {
  1: 'Ruim',
  2: 'Fraca',
  3: 'Boa',
  4: 'Muito boa',
  5: 'Excelente',
}

/** Link de uma estrela: abre a página de avaliação já com a nota marcada. */
export function reviewRatingUrl(
  bookingId: string,
  rating: (typeof REVIEW_RATINGS)[number],
): string {
  return `${publicEnv.siteUrl}${reviewPagePath(bookingId, rating)}`
}

/** 5 estrelas clicáveis — cada uma é um link com a nota (?nota=1..5). */
function starsBlock(bookingId: string): string {
  const cells = REVIEW_RATINGS.map((n) => {
    const href = esc(reviewRatingUrl(bookingId, n))
    const label = `${n} ${n === 1 ? 'estrela' : 'estrelas'} — ${RATING_LABEL[n]}`
    return `<td align="center" style="padding:0 4px;"><a href="${href}" title="${esc(label)}" aria-label="${esc(label)}" style="display:block;text-decoration:none;color:${C.accent};font:400 40px/1 Arial,sans-serif;">&#9733;</a><a href="${href}" style="display:block;margin-top:4px;text-decoration:none;font:600 12px ${SANS};color:${C.muted};">${n}</a></td>`
  }).join('')
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:4px auto 6px;"><tr>${cells}</tr></table>
<p style="margin:0;text-align:center;font:500 12px ${SANS};color:${C.muted};">Toque em uma estrela: 1 é ruim, 5 é excelente.</p>`
}

function reviewText(t: ReviewRequestTarget, lead: string): string {
  const lines = REVIEW_RATINGS.map(
    (n) =>
      `${n} ${n === 1 ? 'estrela' : 'estrelas'} (${RATING_LABEL[n]}): ${reviewRatingUrl(t.bookingId, n)}`,
  )
  return [lead, '', 'Escolha sua nota:', ...lines, '', 'Leva menos de um minuto.'].join('\n')
}

const REVIEW_FOOTER =
  'Você recebeu este e-mail porque se hospedou com uma reserva feita em rotadaspousadas.com.br.<br>Pedimos a avaliação uma vez e lembramos no máximo mais uma.'

/**
 * Pedido de avaliação (1 a 3 dias depois do check-out). Assunto só com o nome
 * da pousada: o código da reserva e o nome do hóspede ficam no corpo.
 */
export function reviewRequestEmail(t: ReviewRequestTarget): Email {
  const na = emPousada(t.pousadaName)
  const question = `Como foi sua estadia ${na} ${t.pousadaName}?`
  const html = wrapLayout({
    preheader: 'Sua nota ajuda outros viajantes e a própria pousada. Leva menos de um minuto.',
    pill: { label: 'Sua opinião', bg: C.accent, fg: C.accentText },
    title: question,
    subtitle: 'Sua nota ajuda outros viajantes a escolher.',
    intro: `${helloName(t.guestName)} Esperamos que a estadia ${na} <strong>${esc(t.pousadaName)}</strong> tenha sido especial. Que nota você dá?`,
    ticketHtml: starsBlock(t.bookingId),
    extraHtml: `<p style="margin:18px 0 0;font:500 12px/1.6 ${SANS};color:${C.muted};text-align:center;">Reserva ${esc(t.code)}. A avaliação aparece na página da pousada sem o seu nome.</p>`,
    cta: {
      href: esc(`${publicEnv.siteUrl}${reviewPagePath(t.bookingId)}`),
      label: 'Avaliar minha estadia',
    },
    ctaHint: 'Leva menos de um minuto.',
    footerNote: REVIEW_FOOTER,
  })
  return {
    subject: question,
    html,
    text: reviewText(
      t,
      `${question}\nSua nota ajuda outros viajantes a escolher. Reserva ${t.code}.`,
    ),
  }
}

/** Lembrete único (3 dias depois do pedido, ainda sem avaliação). */
export function reviewReminderEmail(t: ReviewRequestTarget): Email {
  const na = emPousada(t.pousadaName)
  const question = `Como foi sua estadia ${na} ${t.pousadaName}?`
  const subject = `Ainda dá tempo: como foi sua estadia ${na} ${t.pousadaName}?`
  const html = wrapLayout({
    preheader: 'Último lembrete: sua nota ajuda outros viajantes.',
    pill: { label: 'Último lembrete', bg: C.linen, fg: C.ink },
    title: question,
    subtitle: 'É o último lembrete, prometemos.',
    intro: `${helloName(t.guestName)} Você ainda não avaliou a estadia ${na} <strong>${esc(t.pousadaName)}</strong>. Um toque na estrela já basta.`,
    ticketHtml: starsBlock(t.bookingId),
    extraHtml: `<p style="margin:18px 0 0;font:500 12px/1.6 ${SANS};color:${C.muted};text-align:center;">Reserva ${esc(t.code)}. A avaliação aparece na página da pousada sem o seu nome.</p>`,
    cta: {
      href: esc(`${publicEnv.siteUrl}${reviewPagePath(t.bookingId)}`),
      label: 'Avaliar minha estadia',
    },
    ctaHint: 'Leva menos de um minuto.',
    footerNote: REVIEW_FOOTER,
  })
  return {
    subject,
    html,
    text: reviewText(
      t,
      `${question}\nÚltimo lembrete: sua nota ajuda outros viajantes. Reserva ${t.code}.`,
    ),
  }
}

// ---------------------------------------------------------------------------
// Modelos do Supabase Auth (colados no painel: Authentication → Emails)
// ---------------------------------------------------------------------------
// Quem envia é o Supabase, não o app: o HTML leva as variáveis do Supabase
// (`{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .RedirectTo }}`,
// `{{ .Email }}`) e é gerado daqui para usar o mesmo layout dos e-mails de
// reserva. Gerar de novo: `WRITE_AUTH_TEMPLATES=1 NEXT_PUBLIC_SITE_URL=https://rotadaspousadas.com.br
// pnpm vitest run lib/email/auth-templates.test.ts` → supabase/templates/*.html.

/** Link de um toque: abre /auth/confirm, que só gasta o token no clique em "Entrar". */
const AUTH_CONFIRM_LINK =
  '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next={{ .RedirectTo }}'

function authCodeBox(label: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};border:1px solid ${C.border};border-radius:16px;">
  <tr><td align="center" style="padding:20px 22px 6px;font:600 12px ${SANS};color:${C.muted};">${label}</td></tr>
  <tr><td align="center" style="padding:2px 22px 6px;font:500 38px ${DISPLAY};color:${C.ink};letter-spacing:10px;">{{ .Token }}</td></tr>
  <tr><td align="center" style="padding:0 22px 18px;font:500 12px ${SANS};color:${C.muted};">Vale por 10 minutos e funciona uma única vez.</td></tr>
</table>`
}

const AUTH_SECURITY_NOTICE = notice(
  '<strong>Não foi você?</strong> Pode ignorar este e-mail. Ninguém entra na conta sem este código.',
  'warn',
)

export type AuthEmailTemplate = { subject: string; html: string }

/**
 * "Confirm sign up": primeiro e-mail de quem ainda não tem conta — tanto no
 * cadastro com senha quanto no primeiro "receber código" (o Supabase usa este
 * modelo quando a conta é nova). Por isso o código aparece com destaque.
 */
export function authConfirmSignupTemplate(): AuthEmailTemplate {
  return {
    subject: 'Confirme seu e-mail — código {{ .Token }}',
    html: wrapLayout({
      preheader:
        'Seu código é {{ .Token }}. Confirme o e-mail para ativar sua conta na Rota das Pousadas.',
      pill: { label: 'Boas-vindas', bg: C.accent, fg: C.accentText },
      title: 'Confirme seu e-mail',
      subtitle: 'Falta só um passo para ativar sua conta na Rota das Pousadas.',
      intro:
        'Olá! Que bom ter você por aqui. Para ativar a conta <strong>{{ .Email }}</strong>, toque no botão abaixo ou digite o código na tela de entrada do site.',
      ticketHtml: authCodeBox('Seu código de confirmação'),
      extraHtml: AUTH_SECURITY_NOTICE,
      cta: { href: AUTH_CONFIRM_LINK, label: 'Confirmar meu e-mail' },
      ctaHint: 'Depois de confirmar, é só escolher sua próxima pousada.',
      footerNote:
        'Você recebeu este e-mail porque este endereço foi usado para criar uma conta em rotadaspousadas.com.br.',
    }),
  }
}

/** "Magic link or OTP": entrada sem senha de quem já tem conta. */
export function authMagicLinkTemplate(): AuthEmailTemplate {
  return {
    subject: 'Seu código de acesso: {{ .Token }}',
    html: wrapLayout({
      preheader: 'Seu código é {{ .Token }}. Ele vale por 10 minutos.',
      pill: { label: 'Código de acesso', bg: C.accent, fg: C.accentText },
      title: 'Seu código para entrar',
      subtitle: 'Digite na tela de entrada da Rota das Pousadas. Não precisa de senha.',
      intro:
        'Olá! Use o código abaixo para entrar na conta <strong>{{ .Email }}</strong>. Se preferir, toque no botão e entre com um clique.',
      ticketHtml: authCodeBox('Seu código de acesso'),
      extraHtml: AUTH_SECURITY_NOTICE,
      cta: { href: AUTH_CONFIRM_LINK, label: 'Entrar na minha conta' },
      ctaHint: 'Por segurança, não encaminhe este e-mail para ninguém.',
      footerNote:
        'Você recebeu este e-mail porque alguém pediu um código de acesso para esta conta em rotadaspousadas.com.br.',
    }),
  }
}
