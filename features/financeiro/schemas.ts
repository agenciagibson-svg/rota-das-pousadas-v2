import { z } from 'zod'

export const createExpenseSchema = z.object({
  description: z.string().trim().min(2, 'Descreva a despesa.').max(120),
  amount: z.coerce
    .number({ invalid_type_error: 'Informe o valor.' })
    .min(0.01, 'Informe o valor.')
    .max(10_000_000)
    // Centavos: no máximo 2 casas (a coluna é numeric(14,2) desde a 0083).
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
      'Use no máximo 2 casas decimais.',
    ),
  category: z.enum(['manutencao', 'pessoal', 'insumos', 'marketing', 'impostos', 'outros']),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .optional()
    .or(z.literal('')),
})
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>

export const setExpensePaidSchema = z.object({
  expenseId: z.string().uuid('Despesa inválida.'),
  paid: z.boolean(),
})
export type SetExpensePaidInput = z.infer<typeof setExpensePaidSchema>
