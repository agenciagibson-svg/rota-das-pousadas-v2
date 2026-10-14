'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * Janelas sobre a página (modal, gaveta, menu, folha do app da estadia): ao
 * abrir, o foco entra; o Tab fica preso dentro; ao fechar, volta para quem
 * abriu. Sem isso, quem navega pelo teclado continua "atrás" da janela.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const root = ref.current
    if (!root) return
    const previous = document.activeElement as HTMLElement | null

    const first = focusables(root)[0]
    if (first) first.focus()
    else {
      if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1')
      root.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables(root)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const firstEl = items[0]!
      const lastEl = items[items.length - 1]!
      const current = document.activeElement
      if (e.shiftKey && (current === firstEl || !root.contains(current))) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (current === lastEl || !root.contains(current))) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [ref, active])
}
