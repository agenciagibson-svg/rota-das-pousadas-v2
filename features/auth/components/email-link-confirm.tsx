'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { confirmEmailLinkAction } from '../actions'
import { guestLoginPath, type EmailLinkType } from '../passwordless'

/**
 * Botão "Entrar" do link do e-mail. O token só é usado no toque (POST), para
 * que a pré-visualização do e-mail não gaste o link antes da pessoa.
 */
export function EmailLinkConfirm({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string
  type: EmailLinkType
  next?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    setPending(true)
    const result = await confirmEmailLinkAction({ tokenHash, type, next })
    if (!result.ok) {
      setError(result.error)
      setPending(false)
      return
    }
    router.replace(result.data.redirectTo)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => void onClick()}
      >
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
      {error && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
          <Link
            href={guestLoginPath(next)}
            className="text-primary w-fit text-sm font-semibold hover:underline"
          >
            Receber um código novo
          </Link>
        </div>
      )}
    </div>
  )
}
