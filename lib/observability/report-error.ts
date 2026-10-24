import 'server-only'
import { randomUUID } from 'node:crypto'

/**
 * Envia erros INESPERADOS do servidor para o Sentry.
 *
 * Sem `SENTRY_DSN` não faz nada — os erros continuam só no log da Vercel, como
 * antes. Com a variável configurada, cada falha técnica (action, cron,
 * webhook, render) vira um evento no Sentry, com alerta por e-mail.
 *
 * De propósito NÃO usa o SDK do Sentry: é uma chamada HTTP ao endpoint público
 * de "envelope", só no servidor. Sem dependência nova, sem plugin de build e
 * sem script no navegador (a CSP não muda). Se um dia fizer falta rastrear
 * erro de navegador ou performance, troca-se este arquivo pelo `@sentry/nextjs`
 * mantendo a mesma função.
 *
 * Privacidade: vai o tipo, a mensagem e a pilha do erro, mais o contexto que o
 * chamador informar. Nunca o corpo da requisição nem dados de formulário.
 */

export type ErrorContext = {
  /** Onde estourou: `action`, `cron:expiracao`, `webhook:mercadopago`, `render`... */
  where: string
  route?: string
  /** Só identificadores e rótulos — nada de dado pessoal. */
  tags?: Record<string, string | number | boolean | null | undefined>
}

type Dsn = { publicKey: string; envelopeUrl: string; raw: string }

const TIMEOUT_MS = 1500

/** `https://<chave>@<host>/<projeto>` → URL do endpoint de envelope. Exportada para teste. */
export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null
  try {
    const url = new URL(dsn.trim())
    const projectId = url.pathname.replace(/^\/+|\/+$/g, '')
    if (url.protocol !== 'https:' || !url.username || !/^\d+$/.test(projectId)) return null
    return {
      publicKey: url.username,
      envelopeUrl: `https://${url.host}/api/${projectId}/envelope/`,
      raw: dsn.trim(),
    }
  } catch {
    return null
  }
}

/**
 * Mensagens do Postgres às vezes repetem o que a pessoa digitou
 * (`Key (email)=(fulano@x.com) already exists`, `invalid input syntax ... "123"`).
 * E-mail e sequências de 9+ dígitos (CPF, telefone, cartão) não saem do servidor.
 * Exportada para teste e para o log das actions.
 */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[e-mail]')
    .replace(/\d(?:[\s.\-/()]?\d){8,}/g, '[número]')
}

function describe(error: unknown): { type: string; value: string; stack?: string } {
  if (error instanceof Error) {
    return { type: error.name || 'Error', value: error.message, stack: error.stack }
  }
  if (error && typeof error === 'object') {
    // PostgrestError não é `instanceof Error`.
    const e = error as { message?: unknown; code?: unknown }
    return {
      type: typeof e.code === 'string' ? `PostgrestError ${e.code}` : 'Error',
      value: typeof e.message === 'string' ? e.message : 'erro sem mensagem',
    }
  }
  return { type: 'Error', value: String(error) }
}

/** Pilha do V8 → frames do Sentry (do mais antigo ao mais recente). Exportada para teste. */
export function parseStack(stack: string | undefined) {
  if (!stack) return []
  const frames = stack
    .split('\n')
    .slice(1, 40)
    .map((line) => {
      const match =
        /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line) ?? /^\s*at (.+)$/.exec(line)
      if (!match) return null
      if (match.length === 2) return { function: match[1] }
      const filename = match[2]
      return {
        function: match[1] || '<anônimo>',
        filename,
        lineno: Number(match[3]),
        colno: Number(match[4]),
        in_app: !filename.includes('node_modules') && !filename.startsWith('node:'),
      }
    })
    .filter((frame): frame is NonNullable<typeof frame> => frame !== null)
  return frames.reverse()
}

/** Monta o corpo do envelope. Exportada para teste. */
export function buildEnvelope(error: unknown, context: ErrorContext, dsn: Dsn, now = new Date()) {
  const eventId = randomUUID().replaceAll('-', '')
  const { type, value, stack } = describe(error)
  const frames = parseStack(stack)
  const tags: Record<string, string> = { where: context.where }
  if (context.route) tags.route = context.route
  for (const [key, tagValue] of Object.entries(context.tags ?? {})) {
    if (tagValue !== null && tagValue !== undefined) tags[key] = String(tagValue).slice(0, 200)
  }
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: 'node',
    level: 'error',
    logger: 'rota-das-pousadas',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    transaction: context.route ?? context.where,
    tags,
    exception: {
      values: [
        {
          type,
          value: redact(value).slice(0, 2000),
          ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
        },
      ],
    },
  }
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn: dsn.raw }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n')
  return { eventId, body }
}

/**
 * Nunca lança e nunca demora mais que 1,5 s: reportar um erro não pode virar
 * outro erro nem segurar a resposta.
 */
export async function reportError(error: unknown, context: ErrorContext): Promise<void> {
  const dsn = parseDsn(process.env.SENTRY_DSN)
  if (!dsn) return
  try {
    const { body } = buildEnvelope(error, context, dsn)
    await fetch(dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=rota-das-pousadas/1.0`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    // Sentry fora do ar ou DSN errado: o erro original já está no log da Vercel.
  }
}

export type SentryTestResult =
  | { status: 'sem-dsn' }
  | { status: 'enviado'; eventId: string }
  | { status: 'recusado'; http: number }
  | { status: 'sem-resposta' }

/**
 * Manda um erro de teste e diz o que aconteceu — para conferir, depois de
 * cadastrar o `SENTRY_DSN` na Vercel, que os alertas chegam (botão em
 * /admin → Configurações). Diferente de `reportError`, espera a resposta.
 */
export async function sendTestEvent(): Promise<SentryTestResult> {
  const dsn = parseDsn(process.env.SENTRY_DSN)
  if (!dsn) return { status: 'sem-dsn' }
  const { eventId, body } = buildEnvelope(
    new Error('Teste do Sentry: alerta enviado pelo painel master da Rota.'),
    { where: 'admin:teste-sentry' },
    dsn,
  )
  try {
    const res = await fetch(dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=rota-das-pousadas/1.0`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    })
    return res.ok ? { status: 'enviado', eventId } : { status: 'recusado', http: res.status }
  } catch {
    return { status: 'sem-resposta' }
  }
}
