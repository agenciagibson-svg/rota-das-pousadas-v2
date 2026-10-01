import { z } from 'zod'
import { isValidBrPhone, isValidCpf } from '@/lib/validation/br'
import type { PixKeyType } from '@/lib/pix/brcode'

/** Regras puras do Pix direto (0075) — formulário da pousada, envio de comprovante, revisão. */

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Celular',
  aleatoria: 'Chave aleatória',
}

export function isValidCnpj(value: string): boolean {
  const d = value.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (len: number) => {
    const weights =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

const EVP_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidPixKey(type: PixKeyType, key: string): boolean {
  const k = key.trim()
  switch (type) {
    case 'cpf':
      return isValidCpf(k)
    case 'cnpj':
      return isValidCnpj(k)
    case 'email':
      return z.string().email().max(77).safeParse(k).success
    case 'telefone':
      return isValidBrPhone(k, { mobileOnly: true })
    case 'aleatoria':
      return EVP_RE.test(k)
  }
}

export const pixSettingsSchema = z
  .object({
    keyType: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']),
    pixKey: z.string().trim().min(3, 'Informe a chave Pix.').max(77),
    holderName: z
      .string()
      .trim()
      .min(2, 'Informe o nome de quem recebe (como aparece no banco).')
      .max(100),
    city: z.string().trim().min(2, 'Informe a cidade.').max(60),
    enabled: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (!isValidPixKey(d.keyType, d.pixKey)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pixKey'],
        message: `${PIX_KEY_TYPE_LABEL[d.keyType]} inválido para chave Pix.`,
      })
    }
  })
export type PixSettingsInput = z.infer<typeof pixSettingsSchema>

export const PROOF_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const
export const PROOF_MAX_BYTES = 10 * 1024 * 1024

export const submitProofSchema = z.object({
  bookingId: z.string().uuid(),
  filePath: z.string().min(40).max(200),
  fileName: z.string().max(150),
  mimeType: z.enum(PROOF_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(PROOF_MAX_BYTES),
})
export type SubmitProofInput = z.infer<typeof submitProofSchema>

export const reviewProofSchema = z
  .object({
    proofId: z.string().uuid(),
    approve: z.boolean(),
    reason: z.string().trim().max(300),
    /** Valor que entrou no extrato (em reais). Vazio = saldo inteiro da reserva. */
    amount: z.number().positive('Informe o valor que entrou na conta.').max(1_000_000).optional(),
  })
  .refine((d) => d.approve || d.reason.length >= 3, {
    message: 'Explique o motivo para o hóspede (ex.: valor diferente).',
    path: ['reason'],
  })
export type ReviewProofInput = z.infer<typeof reviewProofSchema>

export const resolveReviewSchema = z.object({
  reviewId: z.string().uuid(),
  resolution: z
    .string()
    .trim()
    .min(3, 'Conte o que foi feito (ex.: valor devolvido ao hóspede).')
    .max(500),
})
export type ResolveReviewInput = z.infer<typeof resolveReviewSchema>

/** "R$ 1.234,56" ou "1234,56" → 1234.56. Vazio/ inválido → null. */
export function parseBRL(value: string): number | null {
  const clean = value.replace(/[^\d,.-]/g, '').trim()
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** Caminho no bucket: <bookingId>/<aleatório>.<ext> (a policy do Storage confere o bookingId). */
export function proofObjectPath(bookingId: string, fileName: string, random: string): string {
  const ext = (fileName.split('.').pop() ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5)
  return `${bookingId}/${random}${ext ? `.${ext}` : ''}`
}

/** Mostra a chave com máscara leve (CPF/CNPJ/celular parciais), para conferência. */
export function displayPixKey(type: PixKeyType, key: string): string {
  const d = key.replace(/\D/g, '')
  if (type === 'cpf' && d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (type === 'cnpj' && d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (type === 'telefone') {
    const n = d.replace(/^55(?=\d{10,11}$)/, '')
    return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : key
  }
  return key.trim()
}

// ---------------------------------------------------------------------------
// Fila "Pagamentos para revisar" (0082) — textos usados no painel e no e-mail.
// ---------------------------------------------------------------------------
export type PaymentReviewKind =
  'pix_sem_analise' | 'pago_reserva_cancelada' | 'estorno' | 'valor_excedente'

export const PAYMENT_REVIEW_TEXT: Record<PaymentReviewKind, { title: string; action: string }> = {
  pix_sem_analise: {
    title: 'Reserva cancelada com comprovante Pix sem análise',
    action:
      'O prazo de 24h passou sem ninguém aprovar. Confira no extrato se o Pix entrou: se entrou, devolva o valor ou refaça a reserva com o hóspede.',
  },
  pago_reserva_cancelada: {
    title: 'Pagamento recebido em reserva já cancelada',
    action:
      'O Mercado Pago aprovou um pagamento depois que a reserva foi cancelada. Devolva o valor pelo Mercado Pago ou refaça a reserva, se o quarto ainda estiver livre.',
  },
  estorno: {
    title: 'Pagamento estornado ou devolvido',
    action:
      'O pagamento foi estornado no Mercado Pago. Confira se a reserva deve continuar de pé e fale com o hóspede.',
  },
  valor_excedente: {
    title: 'Recebido acima do valor da reserva',
    action: 'Entrou mais dinheiro do que o total da reserva. Devolva o excedente ao hóspede.',
  },
}
