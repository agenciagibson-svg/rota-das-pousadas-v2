import { z } from 'zod'
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from './labels'

const money = z.coerce
  .number({ invalid_type_error: 'Valor inválido.' })
  .min(0, 'Valor inválido.')
  .max(100_000, 'Valor muito alto.')

const optionalMoney = z
  .union([z.literal(''), z.null(), z.undefined(), money])
  .transform((v) => (v === '' || v == null ? null : Number(v)))

const qty = z.coerce
  .number({ invalid_type_error: 'Quantidade inválida.' })
  .min(0, 'Quantidade inválida.')
  .max(1_000_000, 'Quantidade muito alta.')

function isImagePath(value: string): boolean {
  if (value === '') return true
  if (/^\/(?![/\\])[^\s\\]*$/.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

export const inventoryItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, 'Informe o nome.').max(80, 'Nome muito longo.'),
    category: z.enum(INVENTORY_CATEGORIES),
    unit: z.enum(INVENTORY_UNITS),
    trackStock: z.boolean(),
    initialQuantity: qty.default(0),
    minQuantity: qty.default(0),
    unitCost: optionalMoney,
    salePrice: optionalMoney,
    showInApp: z.boolean(),
    description: z.string().trim().max(300, 'Use no máximo 300 caracteres.').default(''),
    photoUrl: z.string().trim().max(2048).refine(isImagePath, 'Foto inválida.').default(''),
  })
  .refine((v) => !v.showInApp || v.salePrice !== null, {
    path: ['salePrice'],
    message: 'Para aparecer no app, informe o preço (0 para cortesia).',
  })
export type InventoryItemInput = z.input<typeof inventoryItemSchema>

export const itemActiveSchema = z.object({ itemId: z.string().uuid(), active: z.boolean() })

export const movementSchema = z
  .object({
    itemId: z.string().uuid('Item inválido.'),
    kind: z.enum(['entrada', 'saida', 'perda', 'ajuste']),
    quantity: qty,
    unitCost: optionalMoney,
    note: z.string().trim().max(200, 'Use no máximo 200 caracteres.').default(''),
    createExpense: z.boolean().default(false),
  })
  .refine((v) => v.kind === 'ajuste' || v.quantity > 0, {
    path: ['quantity'],
    message: 'Informe a quantidade.',
  })
  .refine((v) => !v.createExpense || (v.unitCost !== null && v.unitCost > 0), {
    path: ['unitCost'],
    message: 'Informe o custo para lançar a despesa.',
  })

export const movementsQuerySchema = z.object({ itemId: z.string().uuid().optional() })
