'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { linkPousadaOwnerAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Botão + mini-formulário inline pra vincular um e-mail já cadastrado como
 * proprietário de uma pousada sem dono (achado da avaliação de 15/09/2026:
 * `createPousadaAsAdmin` cria a pousada sem membership nenhuma). Só
 * renderizado pela tabela quando `canLinkOwner` é true (comercial/master).
 */
export function LinkPousadaOwner({ pousadaId }: { pousadaId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
      >
        <UserPlus className="size-3.5" />
        Vincular proprietário
      </button>
    )
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await linkPousadaOwnerAction({ pousadaId, email })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      setEmail('')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do proprietário"
          className="h-8 w-52 text-xs"
          disabled={isPending}
          autoFocus
        />
        <Button size="sm" disabled={isPending || !email} onClick={submit}>
          Vincular
        </Button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="text-muted-foreground text-xs hover:underline disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
