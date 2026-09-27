import { z } from 'zod'

/**
 * Validadores compartilhados de formato brasileiro (UF, telefone, CEP).
 *
 * Nunca usar `.transform()` aqui — schemas usados com `createAction`
 * (`actions/create-action.ts`) exigem `Input` = `Output` do Zod, senão a
 * inferência de tipo da action quebra (ver comentário em
 * `features/admin/schemas.ts`). Validamos o formato da string como o usuário
 * digitou; normalização (tirar máscara) acontece depois, no banco — ex.: a
 * RPC `upsert_guest` já limpa o telefone pra deduplicar hóspede.
 */

export const BR_UF_CODES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

export type BrUf = (typeof BR_UF_CODES)[number]

const BR_UF_SET = new Set<string>(BR_UF_CODES)

/**
 * Valida a sigla sem forçar maiúsculas no valor de saída (nada de
 * `.transform()` — ver comentário acima). Aceita "mg" ou "MG" na entrada,
 * mas não altera o que o usuário digitou.
 */
export const ufSchema = z
  .string()
  .trim()
  .length(2, 'UF deve ter 2 letras (ex.: MG).')
  .refine((v) => BR_UF_SET.has(v.toUpperCase()), 'UF inválida (use a sigla, ex.: MG).')

/** Com ou sem máscara: (11) 91234-5678, 11912345678, 11 3456-7890 — DDD + 8 ou 9 dígitos. */
export const phoneRegex = /^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/

export const phoneSchema = z.string().trim().regex(phoneRegex, 'Telefone inválido (inclua o DDD).')

/** Com ou sem hífen: 00000-000 ou 00000000. */
export const cepRegex = /^\d{5}-?\d{3}$/

export const cepSchema = z.string().trim().regex(cepRegex, 'CEP inválido (formato 00000-000).')

/** Dígitos verificadores do CPF (aceita com ou sem máscara). */
export function isValidCpf(value: string): boolean {
  const d = value.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

/** DDDs em uso no Brasil (Anatel). */
export const BR_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

/**
 * Telefone brasileiro de verdade: DDD existente, celular com 9 dígitos
 * começando em 9 (fixo com 8 dígitos começando em 2–5), sem sequência repetida.
 */
export function isValidBrPhone(value: string, opts: { mobileOnly?: boolean } = {}): boolean {
  const d = value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length !== 10 && d.length !== 11) return false
  if (!BR_DDDS.has(Number(d.slice(0, 2)))) return false
  const local = d.slice(2)
  if (/^(\d)\1+$/.test(local)) return false
  if (local.length === 9) return local.startsWith('9')
  if (opts.mobileOnly) return false
  return /^[2-5]/.test(local)
}

/** Número internacional no formato +<país><número> (8 a 15 dígitos, padrão E.164). */
export function isValidIntlPhone(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.startsWith('+')) return false
  const d = trimmed.replace(/\D/g, '')
  return d.length >= 8 && d.length <= 15 && !d.startsWith('0') && !/^(\d)\1+$/.test(d)
}
