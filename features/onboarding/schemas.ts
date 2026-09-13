import { z } from 'zod'
import { ufSchema } from '@/lib/validation/br'

/** Cadastro de pousada pelo proprietário. */
export const createPousadaSchema = z.object({
  name: z.string().trim().min(3, 'Nome muito curto.').max(80, 'Nome muito longo.'),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80),
  state: ufSchema,
  description: z
    .string()
    .trim()
    .min(20, 'Descreva sua pousada (mínimo 20 caracteres).')
    .max(2000, 'Descrição muito longa.'),
  pricePerNight: z.coerce
    .number({ invalid_type_error: 'Informe a diária.' })
    .int()
    .min(1, 'Informe a diária.')
    .max(100000, 'Valor muito alto.'),
})
export type CreatePousadaInput = z.infer<typeof createPousadaSchema>
