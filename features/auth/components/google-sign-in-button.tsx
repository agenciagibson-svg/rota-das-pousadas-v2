'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { startGoogleSignInAction } from '../actions'

/**
 * "Continuar com Google". A Server Action devolve a URL de autorização (e
 * grava o cookie do PKCE); o navegador segue para lá e volta por
 * `/auth/callback?next=…`. Só é renderizado com
 * `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` (quem decide é a página).
 */
export function GoogleSignInButton({ next }: { next?: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    setPending(true)
    const result = await startGoogleSignInAction({ next })
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    // Navegação de página inteira: o Google não abre dentro do app.
    window.location.assign(result.data.url)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => void onClick()}
      >
        {pending ? 'Abrindo o Google…' : 'Continuar com Google'}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
