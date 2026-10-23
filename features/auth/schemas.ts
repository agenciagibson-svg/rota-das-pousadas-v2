import { z } from 'zod'

/** Validação de login (client + server). */
export const loginSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** Validação de cadastro. */
export const signupSchema = z.object({
  name: z.string().min(2, 'Informe seu nome.').max(80, 'Nome muito longo.'),
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  password: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .max(72, 'A senha deve ter no máximo 72 caracteres.'),
})
export type SignupInput = z.infer<typeof signupSchema>

/** Completar/corrigir o nome de um cadastro que chegou sem nome (conta de teste, magic link). */
export const updateNameSchema = z.object({
  name: z.string().min(2, 'Informe seu nome completo.').max(80, 'Nome muito longo.'),
})
export type UpdateNameInput = z.infer<typeof updateNameSchema>

const audience = z.enum(['hospede', 'parceiro', 'admin'])

/** "Esqueci minha senha": só o e-mail (+ de qual login a pessoa veio). */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  audience,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

/** Nova senha a partir do link do e-mail. Mesmas regras do cadastro. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Link inválido.').max(512, 'Link inválido.'),
    password: z
      .string()
      .min(8, 'A senha deve ter ao menos 8 caracteres.')
      .max(72, 'A senha deve ter no máximo 72 caracteres.'),
    confirm: z.string().min(1, 'Repita a nova senha.'),
    audience,
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não são iguais.',
    path: ['confirm'],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/** Destino depois de entrar (validado de novo no servidor com `safeNextPath`). */
const nextField = z.string().max(500).optional()

/** "Receber código por e-mail": passo 1, o e-mail. */
export const emailCodeRequestSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.').max(254),
  next: nextField,
})
export type EmailCodeRequestInput = z.infer<typeof emailCodeRequestSchema>

/** Passo 2: o código de 6 números que chegou no e-mail. */
export const emailCodeVerifySchema = emailCodeRequestSchema.extend({
  code: z
    .string()
    .trim()
    .min(1, 'Digite o código que enviamos.')
    .regex(/^\d{6}$/, 'O código tem 6 números.'),
})
export type EmailCodeVerifyInput = z.infer<typeof emailCodeVerifySchema>

/** Link do e-mail aberto em `/auth/confirm` (consumido só no clique, via POST). */
export const emailLinkConfirmSchema = z.object({
  tokenHash: z.string().regex(/^[A-Za-z0-9_-]{10,512}$/, 'Link inválido.'),
  type: z.enum(['email', 'magiclink', 'signup']),
  next: nextField,
})
export type EmailLinkConfirmInput = z.infer<typeof emailLinkConfirmSchema>

/** "Continuar com Google": só o destino. */
export const googleSignInSchema = z.object({ next: nextField })
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>
