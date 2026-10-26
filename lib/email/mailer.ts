import 'server-only'
import nodemailer from 'nodemailer'

/**
 * Envio de e-mail transacional por SMTP. Desde 26/10/2026 sai pelo Resend
 * com o domínio próprio (SMTP_HOST=smtp.resend.com, SMTP_PORT=465,
 * SMTP_USER=resend, SMTP_PASS=chave da API, SMTP_FROM=reservas@rotadaspousadas.com.br).
 * Trocar de provedor é só mudar as env vars, nunca quem chama `sendEmail`.
 *
 * Fail-soft de propósito: notificação nunca pode derrubar reserva nem
 * pagamento. Sem `SMTP_USER`/`SMTP_PASS` configurados, ou se o envio falhar,
 * `sendEmail` loga e retorna `false` — nunca lança. Quem chama nunca precisa
 * de try/catch.
 */

type Transporter = ReturnType<typeof nodemailer.createTransport>

let cachedTransporter: Transporter | null = null
let cachedKey = ''

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) return null

  const key = `${host}:${port}:${user}`
  if (cachedTransporter && cachedKey === key) return cachedTransporter

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  cachedKey = key
  return cachedTransporter
}

export type SendEmailParams = {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Para log: só o domínio do destinatário. O assunto não vai para o log
 * porque traz pousada + código da reserva (LGPD — revisão de 01/10/2026).
 */
export function maskRecipient(to: string): string {
  const at = to.lastIndexOf('@')
  return at > 0 ? `***${to.slice(at)}` : '***'
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; responseCode?: unknown; name?: unknown }
    return String(e.code ?? e.responseCode ?? e.name ?? 'erro')
  }
  return 'erro'
}

export type SendEmailResult =
  | { status: 'enviado'; from: string; host: string }
  | { status: 'sem-config' }
  | { status: 'falhou'; code: string; from: string; host: string }

/** Igual a `sendEmail`, mas diz o que aconteceu (para o botão de teste do admin). Nunca lança. */
export async function sendEmailWithResult(params: SendEmailParams): Promise<SendEmailResult> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn(
      `[email] SMTP não configurado (SMTP_USER/SMTP_PASS ausentes) — e-mail para ${maskRecipient(params.to)} não enviado.`,
    )
    return { status: 'sem-config' }
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || ''
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'

  try {
    await transporter.sendMail({
      from: `"Rota das Pousadas" <${from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
    return { status: 'enviado', from, host }
  } catch (error) {
    const code = errorCode(error)
    console.error(`[email] Falha ao enviar e-mail para ${maskRecipient(params.to)} (código ${code}).`)
    return { status: 'falhou', code, from, host }
  }
}

/** Envia um e-mail transacional. Nunca lança — retorna `false` em qualquer falha (ver comentário do módulo). */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  return (await sendEmailWithResult(params)).status === 'enviado'
}
