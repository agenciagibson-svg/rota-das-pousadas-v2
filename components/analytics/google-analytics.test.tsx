// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/script', () => ({
  default: ({ src }: { src: string }) => <script data-testid="gtag-js" data-src={src} />,
}))

import { GoogleAnalytics } from './google-analytics'
import { CONSENT_STORAGE_KEY } from '@/lib/analytics/consent'
import { track } from '@/lib/analytics/track'

type W = Window & { gtag?: unknown; dataLayer?: unknown[] }

beforeEach(() => {
  window.localStorage.clear()
  delete (window as W).gtag
  delete (window as W).dataLayer
})
afterEach(cleanup)

describe('Google Analytics com aviso de cookies', () => {
  it('sem escolha: mostra o aviso e não carrega nada do Google', () => {
    render(<GoogleAnalytics measurementId="G-TESTE123" />)
    expect(screen.getByRole('dialog', { name: 'Aviso de cookies' })).toBeTruthy()
    expect(screen.queryByTestId('gtag-js')).toBeNull()
    expect((window as W).gtag).toBeUndefined()
  })

  it('aceitar: grava a escolha, instala o gtag e carrega o script', () => {
    render(<GoogleAnalytics measurementId="G-TESTE123" />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }))
    })
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('granted')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('gtag-js').getAttribute('data-src')).toContain('id=G-TESTE123')
    expect(typeof (window as W).gtag).toBe('function')
  })

  it('recusar: não carrega e não pergunta de novo', () => {
    const { unmount } = render(<GoogleAnalytics measurementId="G-TESTE123" />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Recusar' }))
    })
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied')
    unmount()
    render(<GoogleAnalytics measurementId="G-TESTE123" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId('gtag-js')).toBeNull()
    expect((window as W).gtag).toBeUndefined()
  })

  it('sem ID de medição: nada aparece', () => {
    const { container } = render(<GoogleAnalytics measurementId="" />)
    expect(container.innerHTML).toBe('')
  })

  it('evento sem consentimento não faz nada; com o gtag, vai para a fila', () => {
    expect(() => track('view_item', { pousada_nome: 'Pousada Sintética' })).not.toThrow()
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'granted')
    render(<GoogleAnalytics measurementId="G-TESTE123" />)
    track('view_item', { pousada_nome: 'Pousada Sintética' })
    const queued = ((window as W).dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>))
    expect(queued).toContainEqual(['event', 'view_item', { pousada_nome: 'Pousada Sintética' }])
  })
})
