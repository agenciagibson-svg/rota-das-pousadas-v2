'use client'

import { useState, useTransition } from 'react'
import { BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendSentryTestAction } from '../actions'

/**
 * Botão para conferir o Sentry depois de cadastrar o `SENTRY_DSN` na Vercel:
 * manda um erro de teste e mostra se o Sentry aceitou.
 */
export function SentryTest() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  function send() {
    setMessage(null)
    start(async () => {
      const result = await sendSentryTestAction({})
      if (!result.ok) {
        setMessage({ tone: 'warn', text: result.error })
        return
      }
      const r = result.data
      if (r.status === 'enviado') {
        setMessage({
          tone: 'ok',
          text: `Enviado. Procure no Sentry o erro "Teste do Sentry" (evento ${r.eventId.slice(0, 8)}). O alerta por e-mail chega em alguns minutos.`,
        })
      } else if (r.status === 'sem-dsn') {
        setMessage({
          tone: 'warn',
          text: 'O SENTRY_DSN não está configurado na Vercel (ou está em formato errado). Cadastre em Settings → Environment Variables e faça um novo deploy.',
        })
      } else if (r.status === 'recusado') {
        setMessage({
          tone: 'warn',
          text: `O Sentry recusou (HTTP ${r.http}). Confira se o DSN é do projeto certo e se o projeto não foi apagado.`,
        })
      } else {
        setMessage({ tone: 'warn', text: 'O Sentry não respondeu. Tente de novo em instantes.' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-foreground font-semibold">Alertas de erro (Sentry)</h2>
        <p className="text-muted-foreground text-sm">
          Falhas do servidor (reserva, pagamento, cron, webhook) viram alerta por e-mail. Use o
          botão para conferir se está ligado.
        </p>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={send} disabled={pending}>
          <BellRing className="size-4" />
          {pending ? 'Enviando…' : 'Enviar erro de teste'}
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className={
            message.tone === 'ok'
              ? 'text-success text-sm font-medium'
              : 'text-destructive text-sm font-medium'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
