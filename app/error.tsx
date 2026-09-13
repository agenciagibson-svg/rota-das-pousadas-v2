'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Hook for an error-reporting service (Sentry, etc.).
    console.error(error)
  }, [error])

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-5">
      <EmptyState
        size="lg"
        icon={AlertTriangle}
        title="Algo saiu da rota"
        description="Encontramos um erro inesperado. Tente novamente em instantes."
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </div>
  )
}
