'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Botão "Imprimir" — só `window.print()`, nada de estado. Some da folha impressa via `print:hidden` no wrapper. */
export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer className="size-3.5" />
      Imprimir
    </Button>
  )
}
