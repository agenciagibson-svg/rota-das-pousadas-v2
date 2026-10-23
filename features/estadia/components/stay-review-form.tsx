'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { submitStayReviewAction } from '../actions'
import { REVIEW_RATINGS, type ReviewRating } from '../review'

const LABEL: Record<ReviewRating, string> = {
  1: 'Ruim',
  2: 'Fraca',
  3: 'Boa',
  4: 'Muito boa',
  5: 'Excelente',
}

/**
 * Formulário da página de avaliação (link do e-mail, 0089). Grava pela mesma
 * Server Action do app da estadia (`submitStayReviewAction`).
 */
export function StayReviewForm({
  bookingId,
  pousadaName,
  pousadaSlug,
  initialRating,
}: {
  bookingId: string
  pousadaName: string
  pousadaSlug: string
  initialRating: ReviewRating | null
}) {
  const [rating, setRating] = useState<ReviewRating | null>(initialRating)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit() {
    setError(null)
    if (!rating) {
      setError('Escolha de 1 a 5 estrelas.')
      return
    }
    startTransition(async () => {
      const res = await submitStayReviewAction({ bookingId, rating, text })
      if (!res.ok) setError(res.error)
      else setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="text-center" role="status">
        <Star className="fill-ipe text-ipe mx-auto size-10" />
        <p className="text-h3 text-foreground mt-3">Obrigado pela avaliação!</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Ela já conta na nota de {pousadaName} e ajuda outros viajantes a escolher.
        </p>
        <Link
          href={`/pousada/${pousadaSlug}#avaliacoes`}
          className={cn(buttonVariants({ size: 'pill' }), 'mt-6')}
        >
          Ver a página da pousada
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex justify-center gap-1"
        role="group"
        aria-label="Sua nota, de 1 a 5 estrelas"
      >
        {REVIEW_RATINGS.map((n) => (
          <Button
            key={n}
            type="button"
            variant="ghost"
            size="icon-pill"
            aria-pressed={rating === n}
            aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}, ${LABEL[n]}`}
            onClick={() => setRating(n)}
          >
            <Star
              className={cn(
                'size-8',
                rating && n <= rating ? 'fill-ipe text-ipe' : 'fill-pedra text-pedra',
              )}
            />
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-center text-sm" aria-live="polite">
        {rating ? LABEL[rating] : 'Toque em uma estrela'}
      </p>

      <Textarea
        wrapperClassName="mt-6"
        id="comentario"
        name="comentario"
        label="Comentário (opcional)"
        hint="Aparece na página da pousada, sem o seu nome."
        placeholder="Conte o que você mais gostou"
        value={text}
        maxLength={1000}
        rows={4}
        onChange={(e) => setText(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-destructive mt-3 text-sm font-medium">
          {error}
        </p>
      )}

      <Button type="button" size="pill" className="mt-6 w-full" onClick={submit} disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar avaliação'}
      </Button>
    </div>
  )
}
