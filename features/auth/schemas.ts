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
