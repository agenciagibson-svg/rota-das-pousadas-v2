import 'server-only'
import nodemailer from 'nodemailer'

/**
 * Envio de e-mail transacional — fase de piloto usa SMTP do Gmail (conta
 * comum + senha de app, gerada em myaccount.google.com/apppasswords).
 * `SMTP_HOST`/`SMTP_PORT` ficam configuráveis de propósito: trocar de
 * provedor depois (Resend, SendGrid, SES) é só mudar as env vars, nunca
 * quem chama `sendEmail`.
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

/** Envia um e-mail transacional. Nunca lança — retorna `false` em qualquer falha (ver comentário do módulo). */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn(
      `[email] SMTP não configurado (SMTP_USER/SMTP_PASS ausentes) — e-mail para ${params.to} ("${params.subject}") não enviado.`,
    )
    return false
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  try {
    await transporter.sendMail({
      from: `"Rota das Pousadas" <${from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
    return true
  } catch (error) {
    console.error(`[email] Falha ao enviar e-mail para ${params.to} ("${params.subject}"):`, error)
    return false
  }
}
