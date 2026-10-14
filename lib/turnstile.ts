import 'server-only'

/**
 * Verificação server-side do Cloudflare Turnstile (CAPTCHA do formulário
 * público de orçamento).
 *
 * Sem `TURNSTILE_SECRET_KEY`:
 *  - em qualquer build de produção (`NODE_ENV=production`: Vercel Production
 *    e Preview, `next start`) a verificação FALHA — o formulário não aceita
 *    envio sem CAPTCHA. Antes passava direto (fail-open): bastava a variável
 *    sumir num deploy, ou um Preview apontar para o banco de produção, para o
 *    formulário ficar aberto a robôs sem ninguém ver;
 *  - em desenvolvimento e nos testes a verificação é pulada, com aviso no log;
 *  - um ambiente de preview com banco PRÓPRIO pode desligar de propósito com
 *    `TURNSTILE_DISABLED=true`.
 *
 * As variáveis estão documentadas no `.env.example`. A CSP de `proxy.ts`
 * libera o script e o iframe de `challenges.cloudflare.com`.
 */
let warnedMissingSecret = false

function mustVerify(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.TURNSTILE_DISABLED !== 'true'
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (mustVerify()) {
      console.error(
        '[turnstile] TURNSTILE_SECRET_KEY ausente em produção — pedidos de orçamento estão sendo recusados.',
      )
      return false
    }
    if (!warnedMissingSecret) {
      console.warn(
        '[turnstile] TURNSTILE_SECRET_KEY não configurada — verificação de CAPTCHA desligada neste ambiente.',
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
    // Cloudflare fora do ar: recusa. É raro, e aceitar sem verificação viraria
    // a porta de entrada dos robôs justamente quando não dá para conferir.
    return false
  }
}
