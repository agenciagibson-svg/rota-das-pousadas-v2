import { z } from 'zod'
import type { ListQuery } from '@/types'

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Data inválida.')

export const catalogQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
    checkin: date.optional(),
    checkout: date.optional(),
    guests: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((query) => Boolean(query.checkin) === Boolean(query.checkout), {
    message: 'Informe entrada e saída.',
  })
  .refine((query) => !query.checkin || !query.checkout || query.checkout > query.checkin, {
    message: 'A saída deve ser posterior à entrada.',
  })

export function parseCatalogQuery(query: ListQuery) {
  return catalogQuerySchema.parse(query)
}

export function normalizeCatalogText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Um parâmetro da URL pode chegar repetido (`?busca=&busca=Serra`): na home, a
 * sugestão da estação é um botão `name="busca"` no mesmo formulário do campo
 * de destino. Fica o último valor preenchido.
 */
export function singleParam(value: string | string[] | undefined): string | undefined {
  if (!Array.isArray(value)) return value
  const filled = value.filter((v) => v.trim() !== '')
  return filled.length ? filled[filled.length - 1] : (value[value.length - 1] ?? undefined)
}
