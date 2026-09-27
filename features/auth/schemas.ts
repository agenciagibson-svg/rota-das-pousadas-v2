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
