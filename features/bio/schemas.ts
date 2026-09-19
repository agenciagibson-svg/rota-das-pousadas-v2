import { z } from 'zod'
import { phoneSchema } from '@/lib/validation/br'

/**
 * Validação do formulário de orçamento e do relatório.
 *
 * Sem `.transform()` — `createAction` exige `Input` = `Output` do Zod (mesma
 * restrição de `lib/validation/br.ts`). A normalização do telefone acontece no
 * banco, dentro de `create_quote_request`.
 *
 * Esta é a única porta pública de escrita da feature, então a validação aqui é
 * a primeira de duas: a RPC revalida tudo e ainda aplica o limite por telefone.
 */

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Data inválida.')

export const quoteRequestSchema = z
  .object({
    pousadaId: z.string().uuid('Pousada inválida.'),
    name: z.string().trim().min(2, 'Informe seu nome.').max(150),
    phone: phoneSchema,
    email: z.string().trim().email('E-mail inválido.').max(200).or(z.literal('')),
    checkin: dateSchema.or(z.literal('')),
    checkout: dateSchema.or(z.literal('')),
    adults: z.coerce.number().int().min(1, 'Pelo menos 1 hóspede.').max(100),
    children: z.coerce.number().int().min(0).max(100),
    pets: z.boolean(),
    occasion: z.string().trim().max(80),
    message: z.string().trim().max(2000),
    // Vazio até o Cloudflare Turnstile estar configurado (lib/turnstile.ts) —
    // aí a verificação do lado do servidor é quem decide se bloqueia.
    turnstileToken: z.string().optional().default(''),
  })
  .refine((q) => Boolean(q.checkin) === Boolean(q.checkout), {
    message: 'Informe entrada e saída, ou deixe as duas em branco.',
    path: ['checkout'],
  })
  .refine((q) => !q.checkin || !q.checkout || q.checkout > q.checkin, {
    message: 'A saída deve ser posterior à entrada.',
    path: ['checkout'],
  })
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

export const quoteStatusSchema = z.object({
  requestId: z.string().uuid('Pedido inválido.'),
  status: z.enum(['novo', 'respondido', 'convertido', 'descartado']),
  notes: z.string().trim().max(2000),
})
export type QuoteStatusInput = z.infer<typeof quoteStatusSchema>

export const reportRangeSchema = z.object({
  /** Janelas que cabem numa conversa: semana, mês, trimestre. */
  days: z.coerce
    .number()
    .int()
    .refine((d) => [7, 30, 90].includes(d), 'Período inválido.'),
})
export type ReportRangeInput = z.infer<typeof reportRangeSchema>
