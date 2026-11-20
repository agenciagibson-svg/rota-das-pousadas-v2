'use client'

import { useEffect } from 'react'
import { track, type FunnelEvent, type FunnelParams } from '@/lib/analytics/track'
import { CONSENT_EVENT } from '@/lib/analytics/consent'

/**
 * Dispara um evento do funil uma vez quando a página abre. Se o visitante
 * aceitar os cookies depois, o evento sai nesse momento (o GA4 acabou de
 * carregar).
 */
export function TrackEvent({ name, params }: { name: FunnelEvent; params?: FunnelParams }) {
  const key = JSON.stringify([name, params ?? {}])
  useEffect(() => {
    const [eventName, eventParams] = JSON.parse(key) as [FunnelEvent, FunnelParams]
    let sent = false
    const send = () => {
      if (sent) return
      const gtag = (window as unknown as { gtag?: unknown }).gtag
      if (typeof gtag !== 'function') return
      sent = true
      track(eventName, eventParams)
    }
    send()
    // Depois do aceite o gtag é instalado na hora; o próximo tique já o encontra.
    const onConsent = () => window.setTimeout(send, 0)
    window.addEventListener(CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(CONSENT_EVENT, onConsent)
  }, [key])
  return null
}
