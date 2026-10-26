'use client'

import { useState, useTransition } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendEmailTestAction } from '../actions'

/**
 * Botão para conferir o envio de e-mail depois de mexer nas SMTP_* da Vercel:
 * manda um e-mail para quem clicou, pelo mesmo caminho dos avisos de reserva.
 */
export function EmailTest() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  function send() {
    setMessage(null)
    start(async () => {
      const result = await sendEmailTestAction({})
      if (!result.ok) {
        setMessage({ tone: 'warn', text: result.error })
        return
      }
      const r = result.data
      if (r.status === 'enviado') {
        setMessage({
          tone: 'ok',
          text: `Enviado para ${r.to}, saindo de ${r.from}. Confira a caixa de entrada (e o spam).`,
        })
      } else if (r.status === 'sem-config') {
        setMessage({
          tone: 'warn',
          text: 'O envio de e-mail não está configurado na Vercel (faltam SMTP_USER/SMTP_PASS).',
        })
      } else {
        setMessage({
          tone: 'warn',
          text: `O servidor de e-mail (${r.host}) recusou o envio (código ${r.code}). Confira a chave em SMTP_PASS e se o domínio de ${r.from} está verificado.`,
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-foreground font-semibold">Envio de e-mail</h2>
        <p className="text-muted-foreground text-sm">
          Avisos de reserva, pagamento e pedidos saem por aqui. O botão manda um e-mail de teste
          para você.
        </p>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={send} disabled={pending}>
          <Mail className="size-4" />
          {pending ? 'Enviando…' : 'Enviar e-mail de teste'}
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
