'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Compass } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { selectActivePousadaAction } from '@/features/tenant/actions'

export function SelectPousadaForm({ options }: { options: { pousadaId: string; name: string }[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function select(pousadaId: string) {
    setError(null)
    startTransition(async () => {
      const result = await selectActivePousadaAction({ pousadaId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {options.map((option) => (
        <Card key={option.pousadaId} className="p-0">
          <button
            type="button"
            disabled={isPending}
            onClick={() => select(option.pousadaId)}
            className="flex w-full items-center gap-3 rounded-3xl p-4 text-left transition-colors hover:bg-secondary/60 disabled:opacity-50"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Compass className="size-5" />
            </span>
            <span className="font-medium text-foreground">{option.name}</span>
          </button>
        </Card>
      ))}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  )
}
