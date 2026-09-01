import 'server-only'
import type { ZodType } from 'zod'
import type { ActionResult } from '@/types'
import { ok, fail } from './index'

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
      // Log estruturado / Sentry entra aqui (observabilidade §14).
      const message = error instanceof Error ? error.message : 'Erro inesperado.'
      return fail(message)
    }
  }
}
