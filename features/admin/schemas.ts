import { z } from 'zod'
import { ufSchema, phoneSchema } from '@/lib/validation/br'

export const pousadaIdSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})
export type PousadaIdInput = z.infer<typeof pousadaIdSchema>

/** Status que a equipe da plataforma pode atribuir manualmente (tela "Pousadas"). */
export const changePousadaStatusSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
  status: z.enum([
    'rascunho',
    'em_analise',
    'aprovada',
    'publicada',
    'suspensa',
    'arquivada',
    'reprovada',
  ]),
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
  state: ufSchema,
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
  whatsapp: phoneSchema.optional().or(z.literal('')),
  images: z.array(z.string().url('URL de imagem inválida.')).min(1, 'Envie ao menos uma foto.'),
  publishNow: z.boolean(),
})
export type CreatePousadaAdminInput = z.infer<typeof createPousadaAdminSchema>

/** Vincular um e-mail ja cadastrado como proprietario de uma pousada sem dono. */
export const linkPousadaOwnerSchema = z.object({
  pousadaId: z.string().uuid('Identificador inválido.'),
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
})
export type LinkPousadaOwnerInput = z.infer<typeof linkPousadaOwnerSchema>

/** Estações do ano usadas na curadoria de destinos (mesmo enum do banco — migration 0001). */
export const seasonSchema = z.enum(['verao', 'outono', 'inverno', 'primavera'])

/**
 * Campos editáveis de um destino. `rating`/`priceFrom` são conteúdo
 * editorial curado pela equipe (ver repositories/destinations.repository.ts)
 * — `pousadasCount` NÃO entra aqui porque é calculado ao vivo, nunca digitado.
 */
export const destinationInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug muito curto.')
    .max(60, 'Slug muito longo.')
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen.'),
  name: z.string().trim().min(2, 'Nome muito curto.').max(80, 'Nome muito longo.'),
  state: ufSchema,
  image: z.string().trim().url('URL de imagem inválida.'),
  season: z.array(seasonSchema).min(1, 'Selecione ao menos uma estação.'),
  rating: z.coerce
    .number({ invalid_type_error: 'Informe a nota.' })
    .min(0, 'Nota mínima é 0.')
    .max(5, 'Nota máxima é 5.'),
  priceFrom: z.coerce
    .number({ invalid_type_error: 'Informe o preço.' })
    .int()
    .min(0, 'Preço não pode ser negativo.'),
})
export type DestinationFormInput = z.infer<typeof destinationInputSchema>

export const updateDestinationInputSchema = destinationInputSchema.extend({
  id: z.string().uuid('Identificador inválido.'),
})
export type UpdateDestinationFormInput = z.infer<typeof updateDestinationInputSchema>

export const destinationIdSchema = z.object({
  id: z.string().uuid('Identificador inválido.'),
})
export type DestinationIdInput = z.infer<typeof destinationIdSchema>

/** Papéis de plataforma atribuíveis pela tela "Configurações" (espelha o enum `platform_role` do banco). */
export const platformRoleValueSchema = z.enum([
  'suporte',
  'comercial',
  'marketing',
  'financeiro_plataforma',
  'master',
])

export const assignPlatformRoleSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  role: platformRoleValueSchema,
})
export type AssignPlatformRoleInput = z.infer<typeof assignPlatformRoleSchema>

export const revokePlatformRoleSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
})
export type RevokePlatformRoleInput = z.infer<typeof revokePlatformRoleSchema>

/** Janela de meses da tela "Relatórios" (reaproveita `getRevenueByMonth`, que já aceita esse parâmetro). */
export const reportsFilterSchema = z.object({
  months: z.coerce.number().int().min(1, 'Mínimo de 1 mês.').max(24, 'Máximo de 24 meses.'),
})
export type ReportsFilterInput = z.infer<typeof reportsFilterSchema>
