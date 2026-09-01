import { z } from 'zod'

export const createExpenseSchema = z.object({
  description: z.string().trim().min(2, 'Descreva a despesa.').max(120),
  amount: z.coerce
    .number({ invalid_type_error: 'Informe o valor.' })
    .int()
    .min(1, 'Informe o valor.')
    .max(10_000_000),
  category: z.enum(['manutencao', 'pessoal', 'insumos', 'marketing', 'impostos', 'outros']),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .optional()
    .or(z.literal('')),
})
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
