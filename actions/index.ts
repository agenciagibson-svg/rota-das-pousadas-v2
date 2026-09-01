/**
 * Server Actions layer.
 *
 * Business mutations (reservations, host onboarding, payments) are intentionally
 * NOT implemented yet — this folder establishes the pattern and the typed result
 * envelope so future actions are consistent and safe.
 *
 * Convention:
 *   'use server'
 *   export async function doThing(input): Promise<ActionResult<T>> { ... }
 *
 * Always validate input (zod) at the boundary and return `ActionResult`
 * instead of throwing, so forms can render field-level errors.
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
