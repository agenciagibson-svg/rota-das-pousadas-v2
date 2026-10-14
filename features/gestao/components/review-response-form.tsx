'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { respondReviewAction } from '../actions'

export function ReviewResponseForm({
  reviewId,
  initialResponse,
}: {
  reviewId: string
  initialResponse: string | null
}) {
  const router = useRouter()
  const [response, setResponse] = useState(initialResponse ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await respondReviewAction({ reviewId, response })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <textarea
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        rows={3}
        placeholder="Escreva uma resposta pública para o hóspede…"
        className="border-border bg-card text-foreground focus:border-primary w-full resize-none rounded-2xl border px-3 py-2 text-sm transition outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {error ? <span className="text-destructive text-xs font-medium">{error}</span> : <span />}
        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
          <Send className="size-3.5" />
          {isPending ? 'Salvando…' : initialResponse ? 'Atualizar resposta' : 'Responder'}
        </Button>
      </div>
    </div>
  )
}
