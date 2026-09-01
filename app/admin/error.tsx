'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function AdminError({
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
        title="Não foi possível carregar as métricas"
        description="Ocorreu um erro ao consolidar os dados da plataforma. Tente novamente."
        action={<Button onClick={reset}>Tentar novamente</Button>}
      />
    </div>
  )
}
