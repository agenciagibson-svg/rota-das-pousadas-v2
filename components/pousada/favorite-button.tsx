'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { Heart, Loader2 } from 'lucide-react'
import { toggleFavoriteAction } from '@/features/favoritos/actions'
import { cn } from '@/lib/utils'

export function FavoriteButton({
  slug,
  initialFavorite,
  isLoggedIn,
  className,
}: {
  slug: string
  initialFavorite: boolean
  isLoggedIn: boolean
  className?: string
}) {
  const [favorite, setFavorite] = useState(initialFavorite)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!isLoggedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/favoritos/salvar/${slug}`)}`}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary',
          className,
        )}
      >
        <Heart className="size-4" />
        Salvar
      </Link>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError('')
          const previous = favorite
          setFavorite(!favorite)
          startTransition(async () => {
            const result = await toggleFavoriteAction({ slug })
            if (result.ok) {
              setFavorite(result.data.favorite)
              return
            }
            setFavorite(previous)
            setError(result.error)
          })
        }}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition-colors',
          favorite
            ? 'bg-accent text-accent-foreground hover:brightness-105'
            : 'text-foreground hover:bg-secondary',
          isPending && 'opacity-70',
          className,
        )}
        aria-pressed={favorite}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Heart className={cn('size-4', favorite && 'fill-current')} />
        )}
        {favorite ? 'Salva' : 'Salvar'}
      </button>
      {error ? (
        <p className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-destructive/20 bg-card p-2 text-xs text-destructive shadow-card">
          {error}
        </p>
      ) : null}
    </div>
  )
}
