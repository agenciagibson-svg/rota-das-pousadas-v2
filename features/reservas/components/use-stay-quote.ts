'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { nightsBetween, quoteMatches, type StayQuote } from '../pricing'

/** Espera a pessoa parar de mexer nas datas antes de pedir a cotação nova. */
const QUOTE_DEBOUNCE_MS = 400

/**
 * Quando as datas na tela mudam, troca a URL (sem rolar a página) para o
 * Server Component cotar de novo — leitura pelo caminho normal do App Router,
 * sem chamada do navegador ao banco. Cada combinação é pedida uma vez só: se as
 * datas não têm vaga, a página responde sem cotação e não entra em laço.
 */
export function useStayQuote({
  checkin,
  checkout,
  guests,
  quote,
  hrefFor,
}: {
  checkin: string
  checkout: string
  guests: number
  quote: StayQuote | null
  hrefFor: (q: { checkin: string; checkout: string; guests: number }) => string
}): { calculating: boolean } {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [requested, setRequested] = useState<string | null>(
    quote ? `${quote.checkin}|${quote.checkout}` : null,
  )

  const valid = Boolean(checkin && checkout && nightsBetween(checkin, checkout) > 0)
  const upToDate = quoteMatches(quote, checkin, checkout)
  const key = `${checkin}|${checkout}`

  useEffect(() => {
    if (!valid || upToDate || requested === key) return
    const timer = setTimeout(() => {
      setRequested(key)
      startTransition(() => {
        router.replace(hrefFor({ checkin, checkout, guests }), { scroll: false })
      })
    }, QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // `hrefFor` muda a cada render; o que importa são as datas e os hóspedes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, guests, valid, upToDate, requested])

  return { calculating: pending || (valid && !upToDate && requested !== key) }
}
