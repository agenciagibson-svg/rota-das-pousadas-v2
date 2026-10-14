'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker do app da estadia (`public/sw-estadia.js`), com
 * escopo só em `/estadia`. Ele guarda os arquivos estáticos do app e mostra
 * uma página "sem conexão" quando a rede cai — nunca guarda páginas com os
 * dados da estadia. Fora de produção não registra (o modo dev recompila tudo).
 */
export function RegisterStayServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw-estadia.js', { scope: '/estadia' }).catch(() => {
      // Sem service worker o app funciona igual, só não abre offline.
    })
  }, [])
  return null
}
