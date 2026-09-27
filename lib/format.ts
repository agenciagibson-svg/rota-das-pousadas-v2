/**
 * Formatação única de dinheiro e datas do painel. O servidor da Vercel roda
 * em UTC: sem `timeZone` a mesma reserva aparecia "criada às 02:31" numa tela
 * (servidor) e "às 23:31" em outra (navegador).
 */

export const APP_TIME_ZONE = 'America/Sao_Paulo'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** R$ 1.440,00 — aceita null/undefined/NaN como zero. */
export function formatBRL(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  // Intl usa espaço não separável depois do "R$"; normaliza para espaço comum.
  return BRL.format(n).replace(/ /g, ' ')
}

/** "2026-10-16" → "16/10/2026" sem passar por Date (sem risco de fuso). */
export function formatISODate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** Data e hora de um timestamp, sempre no fuso de Brasília. */
export function formatDateTime(
  iso: string | null | undefined,
  timeZone: string = APP_TIME_ZONE,
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date)
}

/** Só a data de um timestamp, no fuso de Brasília. */
export function formatDate(
  iso: string | null | undefined,
  timeZone: string = APP_TIME_ZONE,
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(date)
}

/** "1 noite" / "2 noites", "1 acomodação" / "3 acomodações". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** E-mail utilizável (o repositório troca vazio por um texto de aviso). */
export function isEmail(value: string | null | undefined): boolean {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Link do WhatsApp para um telefone brasileiro (com ou sem DDI) — null se inválido. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `https://wa.me/55${digits}`
  if (digits.length >= 12 && digits.length <= 13) return `https://wa.me/${digits}`
  return null
}

/** Preço de vitrine: "R$ 720" / "R$ 1.440" (sem centavos quando é inteiro). */
export function formatPrice(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Number.isInteger(n) ? `R$ ${n.toLocaleString('pt-BR')}` : formatBRL(n)
}
