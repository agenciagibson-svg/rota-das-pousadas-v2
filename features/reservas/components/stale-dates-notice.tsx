'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Aviso vindo do servidor sobre as datas da URL ("indisponíveis", "inválidas"…).
 * Some assim que o hóspede mexe no formulário logo abaixo — senão o aviso
 * continuaria na tela mesmo depois de escolher um período livre.
 */
export function StaleDatesNotice({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const scope = ref.current?.parentElement
    if (!scope) return
    const hide = (event: Event) => {
      if (ref.current?.contains(event.target as Node)) return
      setVisible(false)
    }
    scope.addEventListener('input', hide)
    scope.addEventListener('change', hide)
    return () => {
      scope.removeEventListener('input', hide)
      scope.removeEventListener('change', hide)
    }
  }, [])

  return (
    <div ref={ref} hidden={!visible}>
      {children}
    </div>
  )
}
