'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { Button } from '@/components/ui/button'
import {
  CONSENT_EVENT,
  readConsent,
  writeConsent,
  type AnalyticsConsent,
} from '@/lib/analytics/consent'

type DataLayerWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

/**
 * Instala o `gtag` no próprio bundle (sem script inline: a CSP do site não
 * aceita) e configura o GA4. Só roda depois do aceite.
 */
function installGtag(measurementId: string): void {
  const w = window as DataLayerWindow
  if (typeof w.gtag === 'function') return
  w.dataLayer = w.dataLayer ?? []
  w.gtag = function gtag() {
    // O gtag.js lê o objeto `arguments` original, não um array copiado.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  w.gtag('js', new Date())
  // O GA4 já não grava o IP completo; nada a ligar aqui.
  w.gtag('config', measurementId)
}

/**
 * Google Analytics 4 com aviso de cookies (LGPD).
 *
 * - Sem `NEXT_PUBLIC_GA_MEASUREMENT_ID`: não renderiza nada.
 * - Sem escolha registrada: mostra o aviso; nada do Google carrega.
 * - Aceitou: carrega o GA4. Recusou: não carrega e não pergunta de novo.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const [consent, setConsent] = useState<AnalyticsConsent | null | 'loading'>('loading')

  useEffect(() => {
    setConsent(readConsent())
    const onChange = (e: Event) => setConsent((e as CustomEvent<AnalyticsConsent>).detail)
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (consent === 'granted') installGtag(measurementId)
  }, [consent, measurementId])

  if (!measurementId || consent === 'loading') return null

  if (consent === 'granted') {
    return (
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
    )
  }

  if (consent === 'denied') return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="border-border bg-card shadow-floating fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border p-4 sm:p-5"
    >
      <p className="text-foreground text-sm leading-relaxed">
        Usamos cookies do Google Analytics para entender como as pessoas chegam ao site e melhorar a
        busca por pousadas. Você escolhe se aceita.{' '}
        <Link href="/privacidade#cookies" className="text-primary font-medium hover:underline">
          Saiba mais
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => writeConsent('granted')}>
          Aceitar
        </Button>
        <Button size="sm" variant="outline" onClick={() => writeConsent('denied')}>
          Recusar
        </Button>
      </div>
    </div>
  )
}
