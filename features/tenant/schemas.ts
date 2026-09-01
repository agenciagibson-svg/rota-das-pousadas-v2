import { z } from 'zod'

export const selectPousadaSchema = z.object({
  pousadaId: z.string().uuid('Pousada inválida.'),
})
export type SelectPousadaInput = z.infer<typeof selectPousadaSchema>
