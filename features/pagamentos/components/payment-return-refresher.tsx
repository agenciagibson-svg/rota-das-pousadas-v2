'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Enquanto a reserva ainda não aparece como confirmada logo depois do
 * pagamento, recarrega os dados da página algumas vezes (a cada 3s, até ~30s).
 * Cada recarga consulta o Mercado Pago de novo no servidor.
 */
export function PaymentReturnRefresher({ maxTries = 10 }: { maxTries?: number }) {
  const router = useRouter()
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (tries >= maxTries) return
    const timer = setTimeout(() => {
      router.refresh()
      setTries((n) => n + 1)
    }, 3000)
    return () => clearTimeout(timer)
  }, [tries, maxTries, router])

  return null
}
