/**
 * Regras das ofertas para ex-hóspedes (0111). Espelho do banco
 * (`offer_recipient_allowed`, checks de `pousada_offers`) — mudar os dois juntos.
 */
export const OFFER_PERCENT_MIN = 5
export const OFFER_PERCENT_MAX = 50
export const OFFER_VALID_DAYS_MIN = 7
export const OFFER_VALID_DAYS_MAX = 90
export const OFFER_VALID_DAYS_DEFAULT = 30
/** Por pessoa: no máximo 1 oferta por mês de cada pousada e 3 por mês no total. */
export const OFFERS_PER_POUSADA_PER_MONTH = 1
export const OFFERS_PER_GUEST_PER_MONTH = 3
/** Janela de envio de e-mail, no horário de Brasília: das 8h às 21h. */
export const OFFER_SEND_FROM_HOUR = 8
export const OFFER_SEND_UNTIL_HOUR = 21

/** Pode mandar e-mail de oferta agora? (nada entre 21h e 8h, Brasília) */
export function inOfferSendWindow(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  )
  return hour >= OFFER_SEND_FROM_HOUR && hour < OFFER_SEND_UNTIL_HOUR
}

/** Página da pousada já com o cupom da oferta. */
export function offerHref(slug: string, code: string): string {
  return `/pousada/${encodeURIComponent(slug)}?cupom=${encodeURIComponent(code)}`
}

/** Código de cupom que veio na URL (`?cupom=`): só o formato que o banco aceita. */
export function couponFromQuery(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9]{3,20}$/.test(code) ? code : null
}

export type OfferKind = 'manual' | 'seis_meses' | 'feriado' | 'aniversario'

export const OFFER_KIND_LABEL: Record<OfferKind, string> = {
  manual: 'Oferta enviada pela pousada',
  seis_meses: '6 meses da estadia',
  feriado: 'Feriado chegando',
  aniversario: '1 ano da estadia',
}
