'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendWelcomeGuideEmailAction, welcomeGuideWhatsappAction } from '../actions'
import type { WelcomeGuideSend } from '../types'

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/**
 * Painel do "Guia de links" numa linha de /admin → Pousadas (0107): manda o
 * guia por e-mail ao proprietário ou abre o WhatsApp da pousada já com o texto.
 */
export function WelcomeGuidePanel({
  pousadaId,
  hasOwner,
  last,
}: {
  pousadaId: string
  hasOwner: boolean
  last: WelcomeGuideSend | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  function sendEmail() {
    setMessage(null)
    start(async () => {
      const result = await sendWelcomeGuideEmailAction({ id: pousadaId })
      if (!result.ok) return setMessage({ tone: 'warn', text: result.error })
      const r = result.data
      const text =
        r.status === 'enviado'
          ? `Guia enviado para ${r.to}.`
          : r.status === 'sem-dono'
            ? 'Esta pousada ainda não tem proprietário vinculado.'
            : r.status === 'nao-publicada'
              ? 'Publique a pousada antes: os links levam para a página pública dela.'
              : r.status === 'sem-config'
                ? 'O envio de e-mail não está configurado na Vercel.'
                : 'O servidor de e-mail recusou o envio. Tente de novo em instantes.'
      setMessage({ tone: r.status === 'enviado' ? 'ok' : 'warn', text })
      if (r.status === 'enviado') router.refresh()
    })
  }

  function openWhatsapp() {
    setMessage(null)
    // Abre a aba antes do await: navegador bloqueia popup aberto depois.
    const tab = window.open('', '_blank')
    start(async () => {
      const result = await welcomeGuideWhatsappAction({ id: pousadaId })
      const error = !result.ok ? result.error : 'error' in result.data ? result.data.error : null
      if (error || !result.ok || !('url' in result.data)) {
        tab?.close()
        setMessage({ tone: 'warn', text: error ?? 'Não foi possível abrir o WhatsApp.' })
        return
      }
      if (tab) tab.location.href = result.data.url
      else window.location.href = result.data.url
      setMessage({ tone: 'ok', text: 'WhatsApp aberto com o texto pronto. Confira e envie.' })
      router.refresh()
    })
  }

  return (
    <div className="border-border bg-secondary/40 mt-3 rounded-xl border p-4">
      <p className="text-foreground text-sm font-semibold">Guia de links</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Os 3 links com a origem marcada da pousada e o passo a passo para colocar no Google, no
        Instagram e no WhatsApp.
        {last
          ? ` Último envio: ${formatWhen(last.sentAt)}, ${last.channel === 'email' ? 'por e-mail' : 'pelo WhatsApp'}${last.trigger === 'auto' ? ' (automático)' : ''}.`
          : ' Ainda não enviado.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={sendEmail}
          disabled={pending || !hasOwner}
          title={hasOwner ? undefined : 'Vincule o proprietário antes'}
        >
          <Mail className="size-4" />
          Enviar por e-mail
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={openWhatsapp} disabled={pending}>
          <MessageCircle className="size-4" />
          Enviar pelo WhatsApp
        </Button>
      </div>
      {message && (
        <p
          className={
            message.tone === 'ok' ? 'text-foreground mt-2 text-xs' : 'text-destructive mt-2 text-xs'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
