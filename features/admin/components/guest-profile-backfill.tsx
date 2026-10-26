'use client'

import { useState, useTransition } from 'react'
import { UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { backfillGuestProfilesAction } from '../maintenance-actions'

function fichas(n: number): string {
  return n === 1 ? '1 ficha' : `${n} fichas`
}

/**
 * "Completar fichas antigas" (0097): copia do perfil do viajante para a ficha
 * de hóspede da pousada só o que está vazio. Pode rodar de novo sem medo.
 */
export function GuestProfileBackfill() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  function run() {
    setMessage(null)
    start(async () => {
      const result = await backfillGuestProfilesAction({})
      if (!result.ok) {
        setMessage({ tone: 'warn', text: result.error })
        return
      }
      const r = result.data
      if (r.completed === 0 && r.failed === 0) {
        setMessage({ tone: 'ok', text: 'Nenhuma ficha para completar: está tudo em dia.' })
        return
      }
      const parts = [`${fichas(r.completed)} completada${r.completed === 1 ? '' : 's'}`]
      if (r.failed > 0) parts.push(`${fichas(r.failed)} com falha`)
      let text = `${parts.join(', ')}.`
      if (r.documentsSkipped > 0) {
        text += ` O documento de ${fichas(r.documentsSkipped)} não pôde ser lido com a chave atual e ficou de fora; o hóspede atualiza ao reservar de novo.`
      }
      if (r.hasMore) text += ' Ainda há fichas: clique de novo para continuar.'
      setMessage({ tone: r.failed > 0 ? 'warn' : 'ok', text })
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-foreground font-semibold">Fichas de hóspedes antigas</h2>
        <p className="text-muted-foreground text-sm">
          Reservas feitas antes do “Meu perfil” deixaram a ficha do hóspede sem telefone, documento
          e endereço. O botão completa essas fichas com o perfil do viajante, só nos campos vazios —
          nada que a pousada digitou é trocado. Rodar de novo não muda nada.
        </p>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={run} disabled={pending}>
          <UserCheck className="size-4" />
          {pending ? 'Completando…' : 'Completar fichas antigas'}
        </Button>
      </div>
      {message && (
        <p
          role="status"
          className={
            message.tone === 'ok'
              ? 'text-success text-sm font-medium'
              : 'text-destructive text-sm font-medium'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
