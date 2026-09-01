'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export default function PousadaError({
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
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="flex min-h-[70vh] items-center justify-center px-5">
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar a pousada"
          description="Ocorreu um erro ao buscar os detalhes deste refúgio. Tente novamente."
          action={<Button onClick={reset}>Tentar novamente</Button>}
        />
      </main>
    </div>
  )
}
