'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { publicEnv } from '@/lib/env'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      language?: string
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
 * Widget do Cloudflare Turnstile (CAPTCHA). Usado no formulário público de
 * orçamento e nas telas de entrada (login, cadastro, código por e-mail,
 * esqueci a senha).
 *
 * Não renderiza NADA enquanto `NEXT_PUBLIC_TURNSTILE_SITE_KEY` não estiver
 * configurada.
 *
 * O token vale UMA vez: depois de cada envio (deu certo ou não) o formulário
 * troca `resetKey` e o widget gera outro. Sem isso, a segunda tentativa de
 * login mandaria um token já gasto e o Supabase recusaria.
 *
 * Render explícito via `window.turnstile.render` (em vez do auto-render por
 * `data-sitekey`) porque numa SPA o script pode carregar depois do container
 * já estar montado; o render explícito é determinístico.
 */
export function TurnstileWidget({
  onVerify,
  resetKey = 0,
}: {
  onVerify: (token: string) => void
  /** Mudou → o widget descarta o token atual e gera outro. */
  resetKey?: number
}) {
  const siteKey = publicEnv.turnstileSiteKey
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onVerifyRef = useRef(onVerify)
  // O script pode já estar carregado por outro formulário da mesma página.
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.turnstile),
  )
  // A Cloudflare recusou ou não conseguiu verificar (rede instável, extensão
  // que bloqueia, navegador automatizado). Sem isto a pessoa via só a caixa
  // vermelha e o botão de entrar recusando, sem saber o que fazer.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onVerifyRef.current = onVerify
  }, [onVerify])

  useEffect(() => {
    if (!siteKey || !scriptReady) return
    const container = containerRef.current
    const turnstile = window.turnstile
    if (!container || !turnstile) return

    widgetIdRef.current = turnstile.render(container, {
      sitekey: siteKey,
      language: 'pt-br',
      callback: (token) => {
        setFailed(false)
        onVerifyRef.current(token)
      },
      'expired-callback': () => onVerifyRef.current(''),
      'error-callback': () => {
        setFailed(true)
        onVerifyRef.current('')
      },
    })

    return () => {
      if (widgetIdRef.current) turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [siteKey, scriptReady])

  const restart = useCallback(() => {
    setFailed(false)
    onVerifyRef.current('')
    if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
  }, [])

  // Depois de cada envio: descarta o token gasto e pede outro. O aviso de
  // falha (se houver) some quando a Cloudflare responder de novo.
  useEffect(() => {
    if (resetKey === 0) return
    onVerifyRef.current('')
    if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
  }, [resetKey])

  if (!siteKey) return null

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px]" />
      {failed && (
        <div
          role="alert"
          className="text-destructive -mt-1 flex flex-wrap items-center gap-x-2 text-sm"
        >
          <span>A verificação de segurança não passou.</span>
          <button
            type="button"
            onClick={restart}
            className="text-primary min-h-11 font-semibold underline underline-offset-4"
          >
            Tentar de novo
          </button>
          <span className="text-muted-foreground w-full text-xs">
            Se continuar, recarregue a página ou use outro navegador. Extensões de bloqueio podem
            atrapalhar.
          </span>
        </div>
      )}
    </>
  )
}

/** CAPTCHA ligado neste ambiente? (sem chave pública o widget não aparece). */
export function isCaptchaEnabled(): boolean {
  return Boolean(publicEnv.turnstileSiteKey)
}

export const CAPTCHA_PENDING_MESSAGE =
  'Aguarde a verificação de segurança terminar (a caixa acima do botão) e tente de novo.'

/**
 * Estado do CAPTCHA de um formulário: o token atual, se ele já está pronto
 * para enviar e `renew()` para pedir outro depois de cada envio.
 */
export function useCaptcha() {
  const [token, setToken] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const renew = useCallback(() => setResetKey((k) => k + 1), [])
  const ready = !isCaptchaEnabled() || token.length > 0
  return { token, ready, renew, widgetProps: { onVerify: setToken, resetKey } }
}
