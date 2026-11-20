'use client'

import { useEffect } from 'react'
import {
  ORIGIN_COOKIE,
  ORIGIN_COOKIE_MAX_AGE,
  encodeOrigin,
  originFromVisit,
} from '@/features/origem/origin'

/**
 * Guarda a origem desta visita (link com UTM ou outro site) num cookie do
 * próprio site, para a reserva saber de onde a pessoa veio (0106). Visita
 * direta não apaga a origem anterior. Não guarda dado pessoal e não depende
 * do aceite dos cookies do Google Analytics.
 */
export function OriginCapture() {
  useEffect(() => {
    const origin = originFromVisit(window.location.href, document.referrer)
    if (!origin) return
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${ORIGIN_COOKIE}=${encodeOrigin(origin)}; Max-Age=${ORIGIN_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`
  }, [])
  return null
}
