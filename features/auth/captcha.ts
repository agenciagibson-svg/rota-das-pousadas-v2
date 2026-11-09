/**
 * CAPTCHA (Cloudflare Turnstile) nas entradas: login com senha, cadastro e
 * pedido de código por e-mail.
 *
 * Quem confere o token é o PRÓPRIO Supabase Auth (Authentication → Attack
 * Protection → CAPTCHA, provedor Turnstile, mesma chave secreta). Conferir só
 * nas Server Actions não bastaria: a chave pública do Supabase vai no
 * navegador, e um robô chamaria `/auth/v1/token`, `/signup` e `/otp` direto,
 * pulando o site. O token também é de uso único, então o servidor do site
 * não pode conferir antes (gastaria o token e o Supabase recusaria).
 *
 * Enquanto a proteção não estiver ligada no Supabase, o token vai junto e é
 * ignorado. O "esqueci a senha" é a exceção: o link sai pelo nosso servidor
 * (service_role), então ali `verifyTurnstileToken` confere.
 */

export const CAPTCHA_FAILED_MESSAGE =
  'Não conseguimos confirmar que você não é um robô. Aguarde a verificação de segurança e tente de novo.'

/** `{ captchaToken }` quando há token; nada quando não há. */
export function captchaOption(token: string | undefined): { captchaToken?: string } {
  return token ? { captchaToken: token } : {}
}

/** O Supabase recusou pelo CAPTCHA (token ausente, inválido, vencido ou já usado)? */
export function isCaptchaError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === 'captcha_failed' || /captcha/i.test(error.message)
}
