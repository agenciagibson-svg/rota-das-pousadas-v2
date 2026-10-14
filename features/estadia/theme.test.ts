// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseThemePref,
  resolveTheme,
  STAY_THEME_KEY,
  stayThemeBootScript,
  THEME_COLOR,
} from './theme'

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: dark && query.includes('dark'), media: query })),
  )
}

function mountApp() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLOR.light}">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLOR.dark}">`
  document.body.innerHTML = '<div data-stay-app></div>'
  return document.querySelector<HTMLElement>('[data-stay-app]')!
}

describe('tema do app da estadia', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('interpreta a preferência salva e cai em "sistema" no resto', () => {
    expect(parseThemePref('dark')).toBe('dark')
    expect(parseThemePref('light')).toBe('light')
    expect(parseThemePref('system')).toBe('system')
    expect(parseThemePref(null)).toBe('system')
    expect(parseThemePref('roxo')).toBe('system')
  })

  it('resolve o tema: escolha do hóspede vence; "sistema" segue o celular', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('script de abertura aplica o tema do celular antes da primeira pintura', () => {
    mockSystemDark(true)
    const app = mountApp()
    new Function(stayThemeBootScript)()
    expect(app.dataset.theme).toBe('dark')
  })

  it('script de abertura respeita a escolha salva e pinta a barra do sistema com ela', () => {
    mockSystemDark(true)
    localStorage.setItem(STAY_THEME_KEY, 'light')
    const app = mountApp()
    new Function(stayThemeBootScript)()
    expect(app.dataset.theme).toBe('light')
    const colors = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
      m.getAttribute('content'),
    )
    expect(colors).toEqual([THEME_COLOR.light, THEME_COLOR.light])
  })
})
