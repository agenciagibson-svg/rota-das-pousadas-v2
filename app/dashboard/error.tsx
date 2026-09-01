'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-5">
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar o painel"
        description="Ocorreu um erro ao buscar os dados da sua pousada. Tente novamente."
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </div>
  )
}
