import { z } from 'zod'

/**
 * Exclusão da própria conta (migration 0090). Regras puras, sem servidor —
 * usadas pelo formulário (botão só habilita com o e-mail certo) e de novo
 * pelo service, que é quem decide de verdade.
 */

/** Página pública com o passo a passo (exigida pela Google Play). */
export const DELETE_ACCOUNT_HELP_PATH = '/excluir-conta'
/** Para onde a pessoa vai depois de excluir (sessão já encerrada). */
export const ACCOUNT_DELETED_PATH = '/conta-excluida'

export const deleteAccountSchema = z.object({
  confirmEmail: z
    .string()
    .trim()
    .min(1, 'Digite seu e-mail para confirmar.')
    .max(200, 'E-mail inválido.')
    .email('E-mail inválido.'),
})
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>

/** O e-mail digitado é o da conta? Ignora maiúsculas e espaços nas pontas. */
export function emailsMatch(typed: string, accountEmail: string): boolean {
  const a = typed.trim().toLowerCase()
  const b = accountEmail.trim().toLowerCase()
  return a.length > 0 && a === b
}

export const EMAIL_MISMATCH_MESSAGE = 'O e-mail digitado não é o da sua conta.'
