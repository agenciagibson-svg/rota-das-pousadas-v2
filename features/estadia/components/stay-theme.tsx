'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Moon, Smartphone, Sun } from 'lucide-react'
import {
  parseThemePref,
  resolveTheme,
  STAY_THEME_KEY,
  THEME_COLOR,
  type ResolvedTheme,
  type ThemePref,
} from '../theme'
import { cx, RoundButton } from './stay-ui'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const PREF_EVENT = 'rp-stay-theme'

function readPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(STAY_THEME_KEY))
  } catch {
    return 'system'
  }
}

function subscribePref(onChange: () => void) {
  window.addEventListener(PREF_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(PREF_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function subscribeSystem(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** Barra do sistema: com escolha manual, as duas metas levam a cor escolhida. */
function paintThemeColor(pref: ThemePref, resolved: ResolvedTheme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const media = meta.getAttribute('media') ?? ''
    const color =
      pref === 'system'
        ? THEME_COLOR[media.includes('dark') ? 'dark' : 'light']
        : THEME_COLOR[resolved]
    meta.setAttribute('content', color)
  })
}

type StayTheme = {
  pref: ThemePref
  resolved: ResolvedTheme
  setPref: (pref: ThemePref) => void
}

const ThemeContext = createContext<StayTheme | null>(null)

/**
 * Tema do app da estadia. O script de abertura (`stayThemeBootScript`) já
 * pintou o tema certo antes da hidratação; aqui ele passa a acompanhar o
 * celular (quando o hóspede deixou em "sistema") e a escolha feita no app.
 */
export function StayThemeProvider({ children }: { children: ReactNode }) {
  const pref = useSyncExternalStore(subscribePref, readPref, () => 'system' as ThemePref)
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  )
  const resolved = resolveTheme(pref, systemDark)

  // A primeira passada (hidratação, ainda com o valor do servidor) não mexe
  // no que o script de abertura aplicou — evita piscar claro→escuro.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    document.querySelector('[data-stay-app]')?.setAttribute('data-theme', resolved)
    paintThemeColor(pref, resolved)
  }, [pref, resolved])

  const setPref = useCallback((next: ThemePref) => {
    try {
      if (next === 'system') localStorage.removeItem(STAY_THEME_KEY)
      else localStorage.setItem(STAY_THEME_KEY, next)
    } catch {
      // sem storage: vale só nesta visita
    }
    window.dispatchEvent(new Event(PREF_EVENT))
  }, [])

  return (
    <ThemeContext.Provider value={{ pref, resolved, setPref }}>{children}</ThemeContext.Provider>
  )
}

export function useStayTheme(): StayTheme {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useStayTheme precisa de <StayThemeProvider>.')
  return ctx
}

/** Atalho no topo do app: troca entre claro e escuro na hora. */
export function ThemeQuickToggle() {
  const { resolved, setPref } = useStayTheme()
  const dark = resolved === 'dark'
  return (
    <RoundButton
      label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      onClick={() => setPref(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </RoundButton>
  )
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Do celular', icon: Smartphone },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
]

/** Escolha completa (aba Estadia): seguir o celular, claro ou escuro. */
export function ThemeChoice() {
  const { pref, setPref } = useStayTheme()
  return (
    <div
      role="group"
      aria-label="Aparência do app"
      className="bg-card grid grid-cols-3 gap-1 rounded-full p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = pref === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => setPref(value)}
            className={cx(
              'flex h-11 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold transition-colors',
              on ? 'bg-app-action text-app-on-action' : 'text-app-ink-2 hover:text-app-ink',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
