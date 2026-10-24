'use client'

import { useState, useTransition } from 'react'
import { Wallet } from 'lucide-react'
import { connectMercadoPagoAction } from '../actions'
import { Button } from '@/components/ui/button'

/** `label` troca o texto (ex.: "Reconectar" quando já existe uma conexão). */
export function ConnectMpButton({ label = 'Conectar Mercado Pago' }: { label?: string } = {}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await connectMercadoPagoAction({})
            if (!result.ok) {
              setError(result.error)
              return
            }
            window.location.href = result.data.redirectTo
          })
        }
      >
        <Wallet className="size-4" />
        {pending ? 'Conectando…' : label}
      </Button>
      {error && <p className="text-destructive mt-2 text-xs font-medium">{error}</p>}
    </div>
  )
}
