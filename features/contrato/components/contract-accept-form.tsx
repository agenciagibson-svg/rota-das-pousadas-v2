'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { acceptContractAction } from '../actions'

/**
 * "Li e aceito" + botão. Manda o hash do texto que está na tela: se os dados
 * da pousada mudaram desde então, o banco recusa e pede para recarregar.
 */
export function ContractAcceptForm({
  versionId,
  bodySha256,
  blocked,
}: {
  versionId: string
  bodySha256: string
  /** Faltam dados da pousada: o aceite fica desligado até preencher. */
  blocked: boolean
}) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function accept() {
    setError(null)
    if (!confirmed) {
      setError('Marque que você leu e aceita o contrato.')
      return
    }
    start(async () => {
      const result = await acceptContractAction({ versionId, bodySha256, confirm: true })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-foreground flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="border-input mt-0.5 size-4 rounded"
          checked={confirmed}
          disabled={blocked || pending}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          Li o contrato inteiro e aceito em nome da pousada. Sei que este aceite vale como
          assinatura e fica registrado com data, hora e a minha conta.
        </span>
      </label>
      <div>
        <Button type="button" onClick={accept} disabled={blocked || pending}>
          <FileCheck2 className="size-4" />
          {pending ? 'Registrando…' : 'Aceitar o contrato'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
