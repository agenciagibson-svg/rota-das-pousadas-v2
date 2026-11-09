/**
 * Cadastur — cadastro de prestadores de serviços turísticos do Ministério do
 * Turismo (Lei 11.771/2008). É obrigatório para meios de hospedagem e vale por
 * dois anos. A pousada informa o número no painel; a página pública mostra o
 * selo enquanto o certificado está em dia. Ver 0102.
 *
 * O número é guardado como a pousada digitou (com pontos e traço, como vem no
 * certificado); só a quantidade de dígitos é conferida, porque o formato
 * muda entre pessoa física, MEI e empresa.
 */

export const CADASTUR_SITE = 'https://cadastur.turismo.gov.br'

/** Só dígitos e os separadores do certificado. */
const CADASTUR_CHARS = /^[0-9.\-/ ]+$/
export const CADASTUR_MIN_DIGITS = 8
export const CADASTUR_MAX_DIGITS = 20

export type Cadastur = {
  number: string
  /** Fim da validade do certificado (YYYY-MM-DD); `null` quando não informado. */
  validUntil: string | null
}

export function normalizeCadasturNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isValidCadasturNumber(raw: string): boolean {
  const value = normalizeCadasturNumber(raw)
  if (!value) return false
  if (!CADASTUR_CHARS.test(value)) return false
  const digits = value.replace(/\D/g, '').length
  return digits >= CADASTUR_MIN_DIGITS && digits <= CADASTUR_MAX_DIGITS
}

/** Hoje no formato YYYY-MM-DD, no fuso informado (padrão: Brasília). */
export function todayIso(timeZone = 'America/Sao_Paulo', now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export type CadasturStatus = 'ausente' | 'em_dia' | 'vencido'

export function cadasturStatus(c: Cadastur | null | undefined, today: string): CadasturStatus {
  if (!c || !c.number.trim()) return 'ausente'
  if (c.validUntil && c.validUntil < today) return 'vencido'
  return 'em_dia'
}

/** O selo só aparece para cadastro informado e não vencido. */
export function showCadasturSeal(c: Cadastur | null | undefined, today: string): boolean {
  return cadasturStatus(c, today) === 'em_dia'
}

/** Linha do banco → domínio. Número vazio vira `null` (sem cadastro). */
export function cadasturFromColumns(
  number: string | null | undefined,
  validUntil: string | null | undefined,
): Cadastur | null {
  const n = normalizeCadasturNumber(number ?? '')
  if (!n) return null
  return { number: n, validUntil: validUntil || null }
}
