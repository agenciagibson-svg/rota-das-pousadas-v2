/**
 * Camada de Server Actions.
 *
 * Toda mutação do app é uma Server Action criada por `createAction`
 * (actions/create-action.ts): entrada validada por Zod na borda, regra de
 * negócio no Service e retorno sempre no envelope `ActionResult` — nunca
 * exceção para a tela, para o formulário mostrar o erro no campo certo.
 */
import type { ActionResult } from '@/types'

export type { ActionResult }

/** Helper to build a successful action result. */
export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

/** Helper to build a failed action result. */
export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}
