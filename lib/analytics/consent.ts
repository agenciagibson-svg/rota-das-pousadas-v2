/**
 * Consentimento de cookies de medição (LGPD). Guardado só no navegador do
 * visitante; sem escolha registrada, nada do Google Analytics é carregado.
 */
export type AnalyticsConsent = 'granted' | 'denied'

export const CONSENT_STORAGE_KEY = 'rp-consentimento-medicao'
export const CONSENT_EVENT = 'rp-consentimento'

export function readConsent(): AnalyticsConsent | null {
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

export function writeConsent(value: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value)
  } catch {
    // Navegador sem armazenamento: a escolha vale só para esta página.
  }
  window.dispatchEvent(new CustomEvent<AnalyticsConsent>(CONSENT_EVENT, { detail: value }))
}
