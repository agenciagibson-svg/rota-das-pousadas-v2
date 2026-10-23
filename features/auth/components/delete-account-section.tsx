'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteMyAccountAction } from '../actions'
import { ACCOUNT_DELETED_PATH, emailsMatch } from '../account-deletion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * "Excluir minha conta" (0090). O botão só habilita com o e-mail da conta
 * digitado; quem decide de verdade é o servidor (e-mail de novo, reserva em
 * andamento, dono de pousada).
 */
export function DeleteAccountSection({ email }: { email: string }) {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmed = emailsMatch(typed, email)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed || pending) return
    setError(null)
    setPending(true)
    const result = await deleteMyAccountAction({ confirmEmail: typed })
    if (!result.ok) {
      setError(result.fieldErrors?.confirmEmail ?? result.error)
      setPending(false)
      return
    }
    router.replace(ACCOUNT_DELETED_PATH)
    router.refresh()
  }

  return (
    <section aria-labelledby="excluir-conta-titulo">
      <h2 id="excluir-conta-titulo" className="text-h3 text-foreground">
        Excluir minha conta
      </h2>
      <div className="text-muted-foreground mt-3 space-y-2 text-sm">
        <p>
          Apagamos seu cadastro, documento, endereço, telefone e favoritos, e você sai da conta.
        </p>
        <p>
          Reservas, pagamentos e a ficha de hospedagem ficam guardados pela pousada, porque a lei
          obriga, mas deixam de ficar ligados a você.
        </p>
        <p>Não dá para desfazer.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <Input
          id="confirmar-exclusao"
          name="confirmEmail"
          type="email"
          autoComplete="off"
          label="Digite seu e-mail para confirmar"
          placeholder={email}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value)
            setError(null)
          }}
          error={error ?? undefined}
        />
        <Button
          type="submit"
          variant="destructive"
          size="pill"
          className="self-start"
          disabled={!confirmed || pending}
        >
          <Trash2 className="size-4" />
          {pending ? 'Excluindo…' : 'Excluir minha conta'}
        </Button>
      </form>
    </section>
  )
}
