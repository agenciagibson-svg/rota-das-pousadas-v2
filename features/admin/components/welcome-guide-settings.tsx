'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setWelcomeGuideAutoAction } from '../actions'

/**
 * /admin → Configurações (só master): liga/desliga o envio automático do guia
 * de links quando uma pousada é publicada (0107).
 */
export function WelcomeGuideSettings({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    const next = !enabled
    setError(null)
    setEnabled(next)
    start(async () => {
      const result = await setWelcomeGuideAutoAction({ enabled: next })
      if (!result.ok) {
        setEnabled(!next)
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground flex items-center gap-2 font-semibold">
            <Send className="size-4" />
            Guia de links para pousadas novas
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Quando uma pousada é publicada, o proprietário recebe por e-mail os 3 links com a origem
            marcada (perfil do Google, bio do Instagram e WhatsApp) e o passo a passo para colocar
            cada um. Vai uma vez por pousada; se ela ainda não tiver proprietário, sai quando ele
            for vinculado.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enviar o guia automaticamente"
          onClick={toggle}
          disabled={pending}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60',
            enabled ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'bg-background inline-block size-5 rounded-full shadow transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </button>
      </div>
      <p className="text-muted-foreground text-sm">
        {enabled ? (
          <>
            <span className="text-foreground font-semibold">Ligado:</span> o e-mail sai sozinho na
            publicação.
          </>
        ) : (
          <>
            <span className="text-foreground font-semibold">Desligado:</span> nada sai sozinho.
          </>
        )}{' '}
        Para mandar na mão (por e-mail ou WhatsApp), use o botão “Guia de links” em Pousadas.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
