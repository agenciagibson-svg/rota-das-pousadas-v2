// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { OriginCapture } from './origin-capture'
import { ORIGIN_COOKIE, decodeOrigin } from '@/features/origem/origin'

function readCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${ORIGIN_COOKIE}=`))
    ?.slice(ORIGIN_COOKIE.length + 1)
}

afterEach(() => {
  cleanup()
  document.cookie = `${ORIGIN_COOKIE}=; Max-Age=0; Path=/`
  window.history.replaceState(null, '', '/')
})

describe('captura da origem da visita (0106)', () => {
  it('link com UTM grava a origem no cookie do site', () => {
    window.history.replaceState(null, '', '/pousada/x?utm_source=instagram&utm_medium=bio')
    render(<OriginCapture />)
    const origin = decodeOrigin(readCookie())
    expect(origin?.source).toBe('instagram')
    expect(origin?.landingPath).toBe('/pousada/x')
  })

  it('visita direta não apaga a origem anterior', () => {
    window.history.replaceState(null, '', '/?utm_source=google&utm_medium=perfil')
    render(<OriginCapture />)
    cleanup()
    window.history.replaceState(null, '', '/pousadas')
    render(<OriginCapture />)
    expect(decodeOrigin(readCookie())?.medium).toBe('perfil')
  })
})
