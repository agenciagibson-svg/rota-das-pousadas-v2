import 'server-only'
import type { ZodType } from 'zod'
import type { ActionResult } from '@/types'
import { ok, fail } from './index'

const GENERIC_ERROR = 'Não foi possível concluir agora. Tente de novo em instantes.'

/**
 * Mensagens técnicas (Postgres/PostgREST/rede, em inglês) não vão para a tela.
 * As mensagens das RPCs (`raise exception` em português) e das regras dos
 * services continuam aparecendo como estão.
 */
const TECHNICAL = [
  /duplicate key/i,
  /violates/i,
  /row-level security/i,
  /permission denied/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /function .* does not exist/i,
  /invalid input syntax/i,
  /null value in column/i,
  /syntax error/i,
  /JWT/,
  /fetch failed/i,
  /ECONN|ETIMEDOUT|ENOTFOUND/,
  /timeout/i,
  /^Unexpected/i,
]

function describe(error: unknown) {
  if (error instanceof Error) {
    const e = error as Error & { code?: unknown }
    return { message: error.message, code: e.code, name: error.name }
  }
  if (error && typeof error === 'object') {
    // PostgrestError não é `instanceof Error`.
    const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
    return {
      message: typeof e.message === 'string' ? e.message : JSON.stringify(error),
      code: e.code,
      details: e.details,
      hint: e.hint,
    }
  }
  return { message: String(error) }
}

/** Mensagem segura para a tela a partir do erro lançado. Exportada para teste. */
export function userMessage(error: unknown): string {
  const { message } = describe(error)
  if (!message || TECHNICAL.some((re) => re.test(message))) return GENERIC_ERROR
  return message
}

/**
 * Fábrica de Server Actions com validação Zod e retorno padronizado
 * `ActionResult<T>`. Nunca lança para a UI: erros de validação viram
 * `fieldErrors`; erros inesperados viram mensagem segura.
 *
 * Uso (dentro de um arquivo 'use server'):
 *   export const createBooking = createAction(bookingSchema, async (input) => {
 *     return bookingService.create(input) // regra de negócio no Service
 *   })
 */
export function createAction<Input, Output>(
  schema: ZodType<Input>,
  handler: (input: Input) => Promise<Output>,
) {
  return async (raw: unknown): Promise<ActionResult<Output>> => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_'
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      return fail('Dados inválidos.', fieldErrors)
    }

    try {
      const data = await handler(parsed.data)
      return ok(data)
    } catch (error) {
      // Aparece nos logs da Vercel (Functions). Sentry pode entrar aqui depois.
      // Não loga o input: pode ter CPF, e-mail e telefone.
      console.error('[action] falhou', describe(error))
      return fail(userMessage(error))
    }
  }
}
