'use client'

import Script from 'next/script'
import { useEffect, useId, useRef, useState } from 'react'
import { publicEnv } from '@/lib/env'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/**
 * Widget do Cloudflare Turnstile (CAPTCHA do formulário público de
 * orçamento). Não renderiza NADA enquanto `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * não estiver configurada — `lib/turnstile.ts` do lado do servidor trata a
 * ausência de chave do mesmo jeito (verificação desligada), então o
 * formulário continua funcionando normalmente até Gibson configurar as duas
 * chaves.
 *
 * Render explícito via `window.turnstile.render` (em vez do
 * auto-render por atributo `data-sitekey`) porque em uma SPA o script pode
 * carregar depois do container já estar montado — o auto-render por
 * `MutationObserver` do próprio Turnstile cobre isso, mas o render explícito
 * é determinístico e mais fácil de testar/depurar.
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const siteKey = publicEnv.turnstileSiteKey
  const containerId = useId().replace(/:/g, '')
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    if (!siteKey || !scriptReady) return
    const container = containerRef.current
    const turnstile = window.turnstile
    if (!container || !turnstile) return

    widgetIdRef.current = turnstile.render(container, {
      sitekey: siteKey,
      callback: onVerify,
      'expired-callback': () => onVerify(''),
      'error-callback': () => onVerify(''),
    })

    return () => {
      if (widgetIdRef.current) turnstile.remove(widgetIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onVerify é estável o bastante para este widget (montado uma vez por formulário aberto).
  }, [siteKey, scriptReady])

  if (!siteKey) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onReady={() => setScriptReady(true)}
      />
      <div id={containerId} ref={containerRef} />
    </>
  )
}
