import 'server-only'

/**
 * Verificação server-side do Cloudflare Turnstile (CAPTCHA do formulário
 * público de orçamento — `create_quote_request` só tinha rate limit por
 * telefone, sem nada contra um robô trocando de número a cada envio).
 *
 * `TURNSTILE_SECRET_KEY` ainda não configurada = verificação DESLIGADA (skip,
 * com aviso no log) — não bloqueia o formulário público antes de Gibson criar
 * o site em https://dash.cloudflare.com/?to=/:account/turnstile e configurar
 * a env var. Assim que a chave existir, passa a exigir e validar o token de
 * verdade.
 */
let warnedMissingSecret = false

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (!warnedMissingSecret) {
      console.warn(
        '[turnstile] TURNSTILE_SECRET_KEY não configurada — verificação de CAPTCHA desligada.',
      )
      warnedMissingSecret = true
    }
    return true
  }
  if (!token) return false

  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return false
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch {
    // Cloudflare fora do ar não pode travar o formulário inteiro — mas isso
    // é raro o bastante para não virar uma porta de bypass em massa.
    return false
  }
}
