import { z } from 'zod'

export const pousadaIdSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})
export type PousadaIdInput = z.infer<typeof pousadaIdSchema>

/** Status que a equipe da plataforma pode atribuir manualmente (tela "Pousadas"). */
export const changePousadaStatusSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
  status: z.enum(['rascunho', 'em_analise', 'aprovada', 'publicada', 'suspensa', 'arquivada', 'reprovada']),
})
export type ChangePousadaStatusInput = z.infer<typeof changePousadaStatusSchema>

export const grantAccessSchema = z.object({
  pousadaId: z.string().uuid('Identificador inválido.'),
  reason: z.string().trim().min(10, 'Descreva o motivo do acesso (mínimo 10 caracteres).'),
  expiresAt: z.string().datetime('Data de expiração inválida.'),
})
export type GrantAccessInput = z.infer<typeof grantAccessSchema>

export const grantIdSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})
export type GrantIdInput = z.infer<typeof grantIdSchema>

/**
 * Cadastro de pousada pelo admin — sem proprietário vinculado ainda
 * (RB-onboarding-admin). Instagram/e-mail/whatsapp ficam opcionais aqui;
 * normalização (URL do Instagram, e-mail em minúsculas) acontece no Service
 * (`createPousadaAsAdmin`) — mantendo o schema livre de `.transform()`, que
 * quebraria a inferência de tipo do `createAction` (Input ≠ Output do Zod).
 */
export const createPousadaAdminSchema = z.object({
  name: z.string().trim().min(3, 'Nome muito curto.').max(80, 'Nome muito longo.'),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80),
  state: z.string().trim().length(2, 'UF com 2 letras (ex.: MG).'),
  description: z
    .string()
    .trim()
    .min(20, 'Descreva a pousada (mínimo 20 caracteres).')
    .max(2000, 'Descrição muito longa.'),
  pricePerNight: z.coerce
    .number({ invalid_type_error: 'Informe a diária.' })
    .int()
    .min(1, 'Informe a diária.')
    .max(100000, 'Valor muito alto.'),
  instagram: z.string().trim().max(200).optional(),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'E-mail inválido.'),
  whatsapp: z.string().trim().max(20).optional(),
  images: z.array(z.string().url('URL de imagem inválida.')).min(1, 'Envie ao menos uma foto.'),
  publishNow: z.boolean(),
})
export type CreatePousadaAdminInput = z.infer<typeof createPousadaAdminSchema>
