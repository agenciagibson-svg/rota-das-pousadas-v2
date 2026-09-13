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
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
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
