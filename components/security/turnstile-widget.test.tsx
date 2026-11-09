// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/script', () => ({ default: () => null }))
vi.mock('@/lib/env', () => ({ publicEnv: { turnstileSiteKey: 'chave-publica-sintetica' } }))

import { TurnstileWidget } from './turnstile-widget'

type Options = {
  callback: (token: string) => void
  'error-callback'?: () => void
}

let options: Options | null = null
const reset = vi.fn()

beforeEach(() => {
  options = null
  reset.mockClear()
  window.turnstile = {
    render: (_el, opts) => {
      options = opts as Options
      return 'widget-1'
    },
    reset,
    remove: vi.fn(),
  }
})

afterEach(() => {
  cleanup()
  delete window.turnstile
})

describe('TurnstileWidget', () => {
  it('repassa o token quando a Cloudflare confirma', () => {
    const onVerify = vi.fn()
    render(<TurnstileWidget onVerify={onVerify} />)
    act(() => options?.callback('token-sintetico'))
    expect(onVerify).toHaveBeenLastCalledWith('token-sintetico')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('falha da Cloudflare: avisa e oferece tentar de novo', () => {
    const onVerify = vi.fn()
    render(<TurnstileWidget onVerify={onVerify} />)
    act(() => options?.['error-callback']?.())
    expect(onVerify).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('alert').textContent).toContain('verificação de segurança não passou')

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(reset).toHaveBeenCalledWith('widget-1')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('resetKey novo descarta o token gasto e pede outro', () => {
    const onVerify = vi.fn()
    const { rerender } = render(<TurnstileWidget onVerify={onVerify} resetKey={0} />)
    act(() => options?.callback('token-gasto'))
    rerender(<TurnstileWidget onVerify={onVerify} resetKey={1} />)
    expect(onVerify).toHaveBeenLastCalledWith('')
    expect(reset).toHaveBeenCalledWith('widget-1')
  })
})
