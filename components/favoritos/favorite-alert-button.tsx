'use client'

import { useState, useTransition } from 'react'
import { Bell, BellRing, Loader2 } from 'lucide-react'
import { toggleFavoriteAlertAction } from '@/features/alertas/actions'
import { cn } from '@/lib/utils'

export function FavoriteAlertButton({
  slug,
  initialActive,
}: {
  slug: string
  initialActive: boolean
}) {
  const [active, setActive] = useState(initialActive)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError('')
          const previous = active
          setActive(!active)
          startTransition(async () => {
            const result = await toggleFavoriteAlertAction({ slug })
            if (result.ok) {
              setActive(result.data.active)
              return
            }
            setActive(previous)
            setError(result.error)
          })
        }}
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors sm:w-auto',
          active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-foreground hover:bg-secondary',
          isPending && 'opacity-70',
        )}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : active ? (
          <BellRing className="size-4" />
        ) : (
          <Bell className="size-4" />
        )}
        {active ? 'Alerta ativo' : 'Ativar alerta'}
      </button>
      {error ? (
        <p className="absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-destructive/20 bg-card p-2 text-xs text-destructive shadow-card">
          {error}
        </p>
      ) : null}
    </div>
  )
}
