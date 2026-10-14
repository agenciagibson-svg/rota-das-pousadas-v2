// @vitest-environment jsdom
import { useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from './use-focus-trap'

function Harness() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Abrir</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true">
          <button>Primeiro</button>
          <a href="#x">Meio</a>
          <button onClick={() => setOpen(false)}>Fechar</button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('leva o foco para dentro, prende o Tab e devolve o foco ao fechar', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Primeiro' }))

    // Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último.
    const last = screen.getByRole('button', { name: 'Fechar' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Primeiro' }))
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)

    fireEvent.click(last)
    expect(document.activeElement).toBe(trigger)
  })
})
